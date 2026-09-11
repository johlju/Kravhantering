// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { createRuntimeCertificateFixture } from '../../containers/hsa-mtls-provisioner/test/runtime-fixture.mjs'

const image = process.env.KRAVHANTERING_HSA_MOCK_IMAGE
const containment = [
  '--read-only',
  '--cap-drop=ALL',
  '--security-opt=no-new-privileges',
  '--tmpfs=/tmp:rw,size=64m,mode=1777',
]

function docker(args, input) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    input,
    timeout: 30_000,
  }).trim()
}

function runNode(script, options = []) {
  return JSON.parse(
    docker([
      'run',
      '--rm',
      ...containment,
      ...options,
      image,
      'node',
      '-e',
      script,
    ]),
  )
}

describe.skipIf(!image)('built HSA directory mock', { timeout: 60_000 }, () => {
  it('preserves identity, administrative override, tools and filesystem containment', () => {
    expect(
      runNode(`
        const fs = require('node:fs')
        const {execFileSync} = require('node:child_process')
        const tools = ['sh','find','stat','getent','touch','rm','dd','sleep','timeout','tar']
        fs.writeFileSync('/tmp/allowed', 'temporary')
        let denied
        try { fs.writeFileSync('/app/forbidden','forbidden') } catch (error) { denied = error.code }
        console.log(JSON.stringify({
          major: Number(process.versions.node.split('.')[0]),
          uid: process.getuid(), gid: process.getgid(), cwd: process.cwd(),
          tools: tools.map(tool => execFileSync('sh',['-c','command -v "$1"','sh',tool],{encoding:'utf8'}).trim().split('/').pop()),
          owner: execFileSync('stat',['-c','%u:%g','src/strict-server.mjs'],{encoding:'utf8'}).trim(),
          temporary: fs.readFileSync('/tmp/allowed','utf8'), denied,
          npm: fs.existsSync('/usr/bin/npm') || fs.existsSync('/usr/local/bin/npm'),
        }))
      `),
    ).toEqual({
      major: 24,
      uid: 1000,
      gid: 1000,
      cwd: '/app/containers/hsa-directory-mock',
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
      temporary: 'temporary',
      denied: 'EROFS',
      npm: false,
    })
    expect(
      runNode(
        'console.log(JSON.stringify([process.getuid(),process.getgid()]))',
        ['--user=0:0'],
      ),
    ).toEqual([0, 0])
  })

  it('rejects startup without required certificate configuration', () => {
    const result = spawnSync('docker', ['run', '--rm', ...containment, image], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stderr)).toEqual({
      diagnostic: 'mock_config_incomplete',
      event: 'hsa_mock_strict_startup_failed',
    })
  })

  it.each([
    ['direct PID 1', [], 137],
    ['Docker init supervision', ['--init'], 143],
  ])(
    'serves fixtures, rejects unauthorized clients and preserves shutdown under %s',
    async (_mode, supervision, exitCode) => {
      const fixture = await createRuntimeCertificateFixture()
      const name = `hsa-mock-contract-${process.pid}`
      const volume = `${name}-bundle`
      try {
        docker(['volume', 'create', volume])
        const bundle = path.dirname(fixture.bundle('mock', 'mock-server.key'))
        const archive = execFileSync('tar', ['-C', bundle, '-cf', '-', '.'])
        // Provision the role bundle outside the runtime; the server sees it read-only.
        docker(
          [
            'run',
            '--rm',
            '-i',
            '--user=0:0',
            '--mount',
            `type=volume,src=${volume},dst=/bundle`,
            image,
            'sh',
            '-ec',
            'tar -xf - -C /bundle; chown -R 1000:1000 /bundle',
          ],
          archive,
        )
        docker([
          'run',
          '--detach',
          ...supervision,
          '--name',
          name,
          ...containment,
          '--network=none',
          '--mount',
          `type=volume,src=${volume},dst=/run/kravhantering/hsa-mtls,readonly`,
          '--env=HSA_MOCK_TLS_CA_PATH=/run/kravhantering/hsa-mtls/adapter-client-ca.crt',
          '--env=HSA_MOCK_TLS_CERT_PATH=/run/kravhantering/hsa-mtls/mock-server.crt',
          '--env=HSA_MOCK_TLS_KEY_PATH=/run/kravhantering/hsa-mtls/mock-server.key',
          '--env=HSA_MOCK_TLS_EXPECTED_CLIENT_SERIAL_NUMBER=SE5560000000-MOCK001',
          image,
        ])
        await expect
          .poll(
            () => {
              const result = spawnSync(
                'docker',
                [
                  'exec',
                  name,
                  'node',
                  '-e',
                  'fetch("http://127.0.0.1:8081/health").then(r=>r.json()).then(r=>console.log(JSON.stringify(r)))',
                ],
                { encoding: 'utf8', timeout: 10_000 },
              )
              return result.status === 0 ? JSON.parse(result.stdout) : null
            },
            { timeout: 15_000 },
          )
          .toEqual({ status: 'ok' })
        const isolation = JSON.parse(
          docker([
            'exec',
            name,
            'node',
            '-e',
            `
        const fs = require('node:fs')
        const bundle = '/run/kravhantering/hsa-mtls'
        let denied
        try {fs.writeFileSync(bundle+'/mock-server.key','forbidden')} catch(error) {denied=error.code}
        console.log(JSON.stringify({files:fs.readdirSync(bundle).sort(),denied}))
      `,
          ]),
        )
        expect(isolation).toEqual({
          files: [
            'adapter-client-ca.crt',
            'mock-server.crt',
            'mock-server.key',
          ],
          denied: 'EROFS',
        })

        const material = async (role, filename) =>
          readFile(fixture.bundle(role, filename), 'utf8')
        const credentials = {
          ca: await material('adapter', 'hsa-server-ca.crt'),
          valid: {
            cert: await material('adapter', 'adapter-client.crt'),
            key: await material('adapter', 'adapter-client.key'),
          },
          wrong: {
            cert: await material('probe', 'wrong-adapter-client.crt'),
            key: await material('probe', 'wrong-adapter-client.key'),
          },
          crossed: {
            cert: await material('app', 'app-client.crt'),
            key: await material('app', 'app-client.key'),
          },
        }
        // The client is a separate container with no server bundle or issuer mount.
        const results = runNode(
          `
        const https = require('node:https')
        const credentials = ${JSON.stringify(credentials)}
        const envelope = id => '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:add="http://www.w3.org/2005/08/addressing" xmlns:urn="urn:riv:hsa:HsaWsResponder:3"><soap:Header><add:MessageID>10000000-0000-4000-8000-000000000001</add:MessageID><add:To>SE165565594230-1000</add:To></soap:Header><soap:Body><urn:GetHsaPerson><urn:hsaIdentity>'+id+'</urn:hsaIdentity></urn:GetHsaPerson></soap:Body></soap:Envelope>'
        function request(client, body = envelope('SE1000-004'), options = {}) {
          return new Promise(resolve => {
            const req = https.request({hostname:'127.0.0.1',port:8443,servername:'hsa-directory-mock',ca:credentials.ca,...client,method:'POST',path:'/svr-hsaws2/hsaws',headers:{'Content-Type':'text/xml','Content-Length':Buffer.byteLength(body)},...options}, res => {
              let body=''; res.on('data', chunk => {body+=chunk}); res.on('end',()=>resolve({status:res.statusCode,body}))
            })
            req.on('error',error=>resolve({error:error.code})); req.end(body)
          })
        }
        ;(async () => console.log(JSON.stringify({
          found: await request(credentials.valid),
          missing: await request(credentials.valid,envelope('SE1000-NOTFOUND')),
          malformed: await request(credentials.valid,'<invalid>'),
          noClient: await request({}),
          wrongClient: await request(credentials.wrong),
          crossedClient: await request(credentials.crossed),
          wrongServer: await request(credentials.valid,undefined,{servername:'wrong.example'}),
        })))()
      `,
          [`--network=container:${name}`],
        )
        expect(results.found.status).toBe(200)
        expect(results.found.body).toContain('kalle@sos.se')
        expect(results.missing.status).toBe(200)
        expect(results.missing.body).toContain('<hsa:userInformations')
        expect(results.missing.body).not.toContain('<hsa:userInformation>')
        expect(results.malformed.status).toBe(500)
        expect(results.malformed.body).toContain('<hsa:code>3</hsa:code>')
        expect(results.noClient.error).toBe(
          'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
        )
        expect(results.wrongClient.status).toBe(403)
        expect(results.crossedClient.error).toBeTruthy()
        expect(results.wrongServer.error).toBe('ERR_TLS_CERT_ALTNAME_INVALID')
        docker(['stop', '--time=5', name])
        expect(JSON.parse(docker(['inspect', name]))[0].State.ExitCode).toBe(
          exitCode,
        )
      } finally {
        spawnSync('docker', ['rm', '--force', name], { encoding: 'utf8' })
        spawnSync('docker', ['volume', 'rm', volume], { encoding: 'utf8' })
        await fixture.cleanup()
      }
    },
  )
})
