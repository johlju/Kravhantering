// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const image = process.env.KRAVHANTERING_APP_RUNTIME_IMAGE

function run(args = [], options = {}) {
  return spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--tmpfs=/tmp:rw,size=64m,mode=1777',
      ...(options.dockerArgs ?? []),
      image,
      ...args,
    ],
    { encoding: 'utf8', timeout: 30_000, input: options.input },
  )
}

function node(script, dockerArgs = []) {
  const result = run(['node', '-e', script], { dockerArgs })
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  return JSON.parse(result.stdout)
}

describe.skipIf(!image)(
  'built application runtime',
  { timeout: 30_000 },
  () => {
    it('runs Node 24 with the supported identity and release proof tools', () => {
      expect(
        node(`
      const {execFileSync} = require('node:child_process')
      const tools = ['sh','find','stat','getent','touch','rm','dd','sleep','timeout','tar']
      console.log(JSON.stringify({
        major: Number(process.versions.node.split('.')[0]),
        uid: process.getuid(), gid: process.getgid(), cwd: process.cwd(),
        tools: tools.map(tool => execFileSync('sh',['-c','command -v "$1"','sh',tool], {encoding:'utf8'}).trim().split('/').pop()),
        owner: execFileSync('stat',['-c','%u:%g','server.js'],{encoding:'utf8'}).trim(),
      }))
    `),
      ).toEqual({
        major: 24,
        uid: 1000,
        gid: 1000,
        cwd: '/app',
        tools: [
          'sh',
          'find',
          'stat',
          'getent',
          'touch',
          'rm',
          'dd',
          'sleep',
          'timeout',
          'tar',
        ],
        owner: '1000:1000',
      })
      expect(
        node(
          'console.log(JSON.stringify([process.getuid(),process.getgid()]))',
          ['--user=0:0'],
        ),
      ).toEqual([0, 0])
    })

    it('ships working glibc native image processing and traced database dependencies', () => {
      expect(
        node(`
      const sharp = require('sharp')
      for (const name of ['mssql','tedious','typeorm']) require(name)
      sharp({create:{width:2,height:3,channels:3,background:'#ffffff'}})
        .png().toBuffer().then(buffer => sharp(buffer).metadata())
        .then(({width,height,format}) => console.log(JSON.stringify({width,height,format})))
    `),
      ).toEqual({ width: 2, height: 3, format: 'png' })
    })

    it('retains standalone assets while enforcing the read-only root and writable temporary mount', () => {
      expect(
        node(`
      const fs = require('node:fs')
      fs.writeFileSync('/tmp/runtime-contract','allowed')
      let denied
      try {fs.writeFileSync('/app/forbidden','forbidden')} catch(error) {denied=error.code}
      console.log(JSON.stringify({
        temporary: fs.readFileSync('/tmp/runtime-contract','utf8'), denied,
        server: fs.statSync('server.js').isFile(),
        static: fs.readdirSync('.next/static').length > 0,
        logo: fs.statSync('public/logo-small.png').isFile(),
        npm: fs.existsSync('/usr/bin/npm') || fs.existsSync('/usr/local/bin/npm'),
      }))
    `),
      ).toEqual({
        temporary: 'allowed',
        denied: 'EROFS',
        server: true,
        static: true,
        logo: true,
        npm: false,
      })
    })

    it('authenticates private TLS peers and rejects untrusted or mismatched identities', () => {
      const directory = mkdtempSync(path.join(tmpdir(), 'app-runtime-tls-'))
      try {
        const certPath = path.join(directory, 'cert.pem')
        const keyPath = path.join(directory, 'key.pem')
        execFileSync(
          'openssl',
          [
            'req',
            '-x509',
            '-newkey',
            'rsa:2048',
            '-nodes',
            '-keyout',
            keyPath,
            '-out',
            certPath,
            '-days',
            '1',
            '-subj',
            '/CN=localhost',
            '-addext',
            'subjectAltName=DNS:localhost',
          ],
          { stdio: 'ignore' },
        )
        const cert = readFileSync(certPath, 'utf8')
        const key = readFileSync(keyPath, 'utf8')
        expect(
          node(`
        const tls = require('node:tls')
        const cert = ${JSON.stringify(cert)}
        const key = ${JSON.stringify(key)}
        const server = tls.createServer({cert,key,ca:cert,requestCert:true,rejectUnauthorized:true},
          socket => socket.end(socket.authorized ? 'authenticated' : 'unauthorized'))
        server.on('tlsClientError', () => {})
        server.listen(0, '127.0.0.1', async () => {
          async function connect(options) {
            return new Promise(resolve => {
              const socket = tls.connect({host:'127.0.0.1',port:server.address().port,
                servername:'localhost',cert,key,...options})
              let result = ''
              socket.on('data', data => {result += data})
              socket.on('error', error => resolve(error.code))
              socket.on('end', () => resolve(result))
            })
          }
          const trusted = await connect({ca:cert})
          const untrusted = await connect({})
          const wrongIdentity = await connect({ca:cert,servername:'wrong.example'})
          const missingClient = await connect({ca:cert,cert:undefined,key:undefined})
          server.close(() => console.log(JSON.stringify({trusted,untrusted,wrongIdentity,missingClient})))
        })
      `),
        ).toEqual({
          trusted: 'authenticated',
          untrusted: 'DEPTH_ZERO_SELF_SIGNED_CERT',
          wrongIdentity: 'ERR_TLS_CERT_ALTNAME_INVALID',
          missingClient: 'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
        })
      } finally {
        rmSync(directory, { recursive: true, force: true })
      }
    })

    it('serves build metadata through the default command and shuts down on SIGTERM', async () => {
      const name = `app-runtime-contract-${process.pid}`
      const docker = (...args) =>
        execFileSync('docker', args, {
          encoding: 'utf8',
          timeout: 30_000,
        }).trim()
      try {
        docker(
          'run',
          '--detach',
          '--name',
          name,
          '--read-only',
          '--cap-drop=ALL',
          '--security-opt=no-new-privileges',
          '--tmpfs=/tmp:rw,size=64m,mode=1777',
          '--network=none',
          '--env=AUTH_OIDC_ISSUER_URL=https://issuer.example.com',
          '--env=AUTH_OIDC_CLIENT_ID=runtime-contract',
          '--env=AUTH_OIDC_CLIENT_SECRET=runtime-contract-client-secret',
          '--env=AUTH_OIDC_REDIRECT_URI=https://app.example.com/api/auth/callback',
          '--env=AUTH_OIDC_POST_LOGOUT_REDIRECT_URI=https://app.example.com/',
          '--env=AUTH_SESSION_COOKIE_PASSWORD=runtime-contract-session-password-of-sufficient-length',
          image,
        )
        await expect
          .poll(() => docker('logs', name), { timeout: 15_000 })
          .toContain('Ready in')
        const metadata = JSON.parse(
          docker(
            'exec',
            name,
            'node',
            '-e',
            'fetch("http://127.0.0.1:3000/build.json").then(r=>r.json()).then(r=>console.log(JSON.stringify(r)))',
          ),
        )
        expect(metadata.version).toMatch(/^\d+\.\d+\.\d+/u)
        expect(metadata.commitSha).toMatch(/^[a-f0-9]{40}$/u)
        expect(metadata.expectedDatabaseSchemaVersion).toBeTruthy()
        docker('stop', '--time=5', name)
        expect(JSON.parse(docker('inspect', name))[0].State.ExitCode).toBe(143)
      } finally {
        spawnSync('docker', ['rm', '--force', name], { encoding: 'utf8' })
      }
    })

    it('rejects missing authentication configuration through its default command', () => {
      const result = run()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(
        'Missing required authentication configuration: AUTH_OIDC_ISSUER_URL.',
      )
    })
  },
)
