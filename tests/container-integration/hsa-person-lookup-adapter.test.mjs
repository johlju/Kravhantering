// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { createRuntimeCertificateFixture } from '../../containers/hsa-mtls-provisioner/test/runtime-fixture.mjs'

const image = process.env.KRAVHANTERING_HSA_ADAPTER_IMAGE
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

describe.skipIf(!image)(
  'built HSA person lookup adapter',
  { timeout: 60_000 },
  () => {
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
        cwd: '/app/containers/hsa-person-lookup-adapter',
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
      const result = spawnSync(
        'docker',
        ['run', '--rm', ...containment, image],
        {
          encoding: 'utf8',
          timeout: 30_000,
        },
      )
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stderr)).toEqual({
        diagnostic: 'adapter_config_incomplete',
        event: 'hsa_adapter_strict_startup_failed',
      })
    })

    it.each([
      ['direct PID 1', [], 137],
      ['init supervision', ['--init'], 143],
    ])(
      'preserves strict REST-to-SOAP behavior and shutdown with %s',
      async (_mode, supervision, exitCode) => {
        const fixture = await createRuntimeCertificateFixture()
        const name = `hsa-adapter-contract-${process.pid}`
        const upstream = `${name}-upstream`
        const volume = `${name}-bundle`
        const material = async (role, filename) =>
          readFile(fixture.bundle(role, filename), 'utf8')
        try {
          docker(['volume', 'create', volume])
          const bundle = path.dirname(
            fixture.bundle('adapter', 'adapter-server.key'),
          )
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
            execFileSync('tar', ['-C', bundle, '-cf', '-', '.']),
          )
          const upstreamMaterial = {
            ca: await material('mock', 'adapter-client-ca.crt'),
            valid: {
              cert: await material('mock', 'mock-server.crt'),
              key: await material('mock', 'mock-server.key'),
            },
            wrong: {
              cert: await material('probe', 'wrong-mock-server.crt'),
              key: await material('probe', 'wrong-mock-server.key'),
            },
            crossed: {
              cert: await material('kong', 'kong-server.crt'),
              key: await material('kong', 'kong-server.key'),
            },
          }
          // A separate TLS peer holds only its server material and verifies adapter mTLS.
          docker([
            'run',
            '--detach',
            '--name',
            upstream,
            ...containment,
            '--network=none',
            image,
            'node',
            '-e',
            `
        const https = require('node:https')
        const credentials = ${JSON.stringify(upstreamMaterial)}
        const envelope = people => '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><hsa:GetHsaPersonResponse xmlns:hsa="urn:riv:hsa:HsaWsResponder:3"><hsa:userInformations>'+people+'</hsa:userInformations></hsa:GetHsaPersonResponse></soap:Body></soap:Envelope>'
        let calls = []
        async function respond(req,res) {
          let body=''; for await (const chunk of req) body+=chunk
          calls.push({body,subject:req.socket.getPeerCertificate().subject.serialNumber,authorized:req.socket.authorized})
          if(body.includes('SE1000-TIMEOUT')) return
          res.setHeader('Content-Type',body.includes('SE1000-MEDIA')?'text/plain':'text/xml')
          if(body.includes('SE1000-OVERSIZED')) return res.end('x'.repeat(1024*1024+1))
          if(body.includes('SE1000-MISSING')) return res.end(envelope(''))
          const person = '<hsa:userInformation><hsa:hsaIdentity>SE1000-004</hsa:hsaIdentity><hsa:givenName>Kalle</hsa:givenName><hsa:mail>kalle@sos.se</hsa:mail></hsa:userInformation>'
          res.end(envelope(person))
        }
        for (const [offset, role] of ['valid','wrong','crossed'].entries()) {
          https.createServer({ca:credentials.ca,...credentials[role],requestCert:true,rejectUnauthorized:true,minVersion:'TLSv1.2'},respond).listen(9443+offset,'127.0.0.1')
        }
        require('node:http').createServer((req,res)=>res.end(JSON.stringify(calls))).listen(9081,'127.0.0.1')
      `,
          ])
          const start = (port, options = []) =>
            docker([
              'run',
              '--detach',
              ...supervision,
              '--name',
              name,
              ...containment,
              `--network=container:${upstream}`,
              '--mount',
              `type=volume,src=${volume},dst=/run/adapter,readonly`,
              '--env=HSA_ADAPTER_INGRESS_CA_PATH=/run/adapter/kong-client-ca.crt',
              '--env=HSA_ADAPTER_INGRESS_CERT_PATH=/run/adapter/adapter-server.crt',
              '--env=HSA_ADAPTER_INGRESS_KEY_PATH=/run/adapter/adapter-server.key',
              '--env=HSA_ADAPTER_INGRESS_EXPECTED_CLIENT_SUBJECT=CN=kravhantering-kong',
              '--env=HSA_SOAP_CA_PATH=/run/adapter/hsa-server-ca.crt',
              '--env=HSA_SOAP_CLIENT_CERT_PATH=/run/adapter/adapter-client.crt',
              '--env=HSA_SOAP_CLIENT_KEY_PATH=/run/adapter/adapter-client.key',
              `--env=HSA_SOAP_ENDPOINT_URL=https://127.0.0.1:${port}/svr-hsaws2/hsaws`,
              '--env=HSA_SOAP_TLS_SERVER_NAME=hsa-directory-mock',
              '--env=HSA_SOAP_TIMEOUT_MS=1000',
              ...options,
              image,
            ])
          const ready = () =>
            expect
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
          const credentials = {
            ca: await material('kong', 'adapter-server-ca.crt'),
            valid: {
              cert: await material('kong', 'kong-client.crt'),
              key: await material('kong', 'kong-client.key'),
            },
            wrong: {
              cert: await material('probe', 'wrong-kong-client.crt'),
              key: await material('probe', 'wrong-kong-client.key'),
            },
            crossed: {
              cert: await material('app', 'app-client.crt'),
              key: await material('app', 'app-client.key'),
            },
          }
          const requestScript = `
        const https = require('node:https')
        const credentials = ${JSON.stringify(credentials)}
        function request(client=credentials.valid,hsaId='SE1000-004',options={}) {
          const body=JSON.stringify({hsaId})
          return new Promise(resolve=>{
            const req=https.request({hostname:'127.0.0.1',port:8443,servername:'hsa-person-lookup-adapter',ca:credentials.ca,...client,method:'POST',path:'/hsa/person-records/lookup',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'X-Kravhantering-HSA-Correlation-ID':'10000000-0000-4000-8000-000000000001'},...options},res=>{
              let body='';res.on('data',chunk=>{body+=chunk});res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}))
            });req.on('error',error=>resolve({error:error.code}));req.end(body)
          })
        }
      `
          start(9443)
          await ready()
          const results = runNode(
            requestScript +
              `
        ;(async()=>console.log(JSON.stringify({
          found:await request(), missing:await request(undefined,'SE1000-MISSING'),
          media:await request(undefined,'SE1000-MEDIA'), oversized:await request(undefined,'SE1000-OVERSIZED'), timeout:await request(undefined,'SE1000-TIMEOUT'),
          noClient:await request({}),wrongClient:await request(credentials.wrong),crossedClient:await request(credentials.crossed),
          wrongServer:await request(undefined,undefined,{servername:'wrong.example'}),
          calls:await fetch('http://127.0.0.1:9081').then(r=>r.json()),
          healthBusiness:await fetch('http://127.0.0.1:8081/hsa/person-records/lookup').then(r=>r.status),
        })))()
      `,
            [`--network=container:${upstream}`],
          )
          expect(results.found).toEqual({
            status: 200,
            body: {
              email: 'kalle@sos.se',
              givenName: 'Kalle',
              hasProtectedPersonalData: false,
              hsaId: 'SE1000-004',
              middleName: null,
              surname: null,
            },
          })
          expect(results.missing.status).toBe(404)
          for (const outcome of [results.media, results.oversized])
            expect(outcome).toEqual({
              status: 503,
              body: {
                code: 'service_unavailable',
                error: 'HSA person lookup adapter is unavailable.',
              },
            })
          expect(results.timeout).toEqual({
            status: 504,
            body: { code: 'timeout', error: 'HSA person lookup timed out.' },
          })
          expect(results.noClient.error).toBe(
            'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED',
          )
          expect(results.wrongClient.status).toBe(403)
          expect(results.crossedClient.error).toBeTruthy()
          expect(results.wrongServer.error).toBe('ERR_TLS_CERT_ALTNAME_INVALID')
          expect(results.healthBusiness).toBe(404)
          expect(results.calls).toHaveLength(5)
          for (const call of results.calls) {
            expect(call.authorized).toBe(true)
            expect(call.subject).toBe('SE5560000000-MOCK001')
            expect(call.body).toContain(
              '<add:MessageID>10000000-0000-4000-8000-000000000001</add:MessageID>',
            )
          }
          const isolation = JSON.parse(
            docker([
              'exec',
              name,
              'node',
              '-e',
              `
        const fs=require('node:fs');let denied
        try {fs.writeFileSync('/run/adapter/adapter-client.key','forbidden')}catch(error){denied=error.code}
        console.log(JSON.stringify({files:fs.readdirSync('/run/adapter').sort(),denied}))
      `,
            ]),
          )
          expect(isolation).toEqual({
            files: [
              'adapter-client.crt',
              'adapter-client.key',
              'adapter-server.crt',
              'adapter-server.key',
              'hsa-server-ca.crt',
              'kong-client-ca.crt',
            ],
            denied: 'EROFS',
          })
          docker(['stop', '--time=5', name])
          expect(JSON.parse(docker(['inspect', name]))[0].State.ExitCode).toBe(
            exitCode,
          )
          docker(['rm', name])
          for (const port of [9444, 9445]) {
            start(port)
            await ready()
            expect(
              runNode(
                requestScript +
                  'request().then(r=>console.log(JSON.stringify(r)))',
                [`--network=container:${upstream}`],
              ),
            ).toEqual({
              status: 503,
              body: {
                code: 'service_unavailable',
                error: 'HSA person lookup adapter is unavailable.',
              },
            })
            docker(['rm', '--force', name])
          }
          // Cross-wired trust also fails closed before exposing the business listener.
          start(9443, [
            '--env=HSA_ADAPTER_INGRESS_CA_PATH=/run/adapter/hsa-server-ca.crt',
          ])
          expect(docker(['wait', name])).toBe('1')
          const logs = spawnSync('docker', ['logs', name], {
            encoding: 'utf8',
            timeout: 10_000,
          })
          expect(JSON.parse(logs.stdout + logs.stderr)).toEqual({
            diagnostic: 'CHAIN_UNTRUSTED',
            event: 'hsa_adapter_strict_startup_failed',
          })
        } finally {
          for (const container of [name, upstream])
            spawnSync('docker', ['rm', '--force', container], {
              encoding: 'utf8',
            })
          spawnSync('docker', ['volume', 'rm', volume], { encoding: 'utf8' })
          await fixture.cleanup()
        }
      },
    )
  },
)
