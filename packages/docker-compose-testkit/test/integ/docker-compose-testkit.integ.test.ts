import path from 'path'
import {describe, it} from 'node:test'
import assert from 'node:assert'
import {fetchAsText} from '@giltayar/http-commons'
import {presult} from '@giltayar/promise-commons'

import {runDockerCompose, tcpHealthCheck} from '../../src/docker-compose-testkit.ts'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('docker-compose-testkit (integ)', function () {
  it('should work with a simple docker-compose', async () => {
    const env = {
      CONTENT_FOLDER: path.join(__dirname, 'fixtures/nginx-test-content'),
    }
    const {teardown, findAddress} = await runDockerCompose(
      path.join(__dirname, 'fixtures/docker-compose.yml'),
      {
        forceRecreate: true,
        env,
      },
    )

    const nginxAddress = await findAddress('nginx')
    const nginx2Address = await findAddress('nginx2')
    await findAddress('postgres', 5432, {healthCheck: tcpHealthCheck})

    assert.match(await fetchAsText(`http://${nginxAddress}`), /Welcome to nginx/)
    assert.strictEqual(
      await fetchAsText(`http://${nginx2Address}`),
      'This content will be available if the CONTENT_FOLDER was set',
    )

    await teardown()

    const {teardown: teardown2, findAddress: findAddress2} = await runDockerCompose(
      path.join(__dirname, 'fixtures/docker-compose.yml'),
      {env},
    )

    const nginxAddress2 = await findAddress2('nginx')

    assert.strictEqual(nginxAddress2, nginxAddress)

    assert.match(await fetchAsText(`http://${nginxAddress2}`), /Welcome to nginx/)

    await teardown2()

    const {teardown: teardown3, findAddress: findAddress3} = await runDockerCompose(
      path.join(__dirname, 'fixtures/docker-compose.yml'),
      {forceRecreate: true, containerCleanup: true, env},
    )

    const nginxAddress3 = await findAddress3('nginx')

    assert.notStrictEqual(nginxAddress3, nginxAddress2)

    assert.match(await fetchAsText(`http://${nginxAddress3}`), /Welcome to nginx/)

    assert.strictEqual(
      (await presult<string, {code: string}>(fetchAsText(`http://${nginxAddress2}`)))[0]?.code,
      'ECONNREFUSED',
    )

    await teardown3()

    assert.strictEqual(
      (await presult<string, {code: string}>(fetchAsText(`http://${nginxAddress3}`)))[0]?.code,
      'ECONNREFUSED',
    )
  })

  it('should work with multiple docker composes in parallel', async () => {
    const {teardown: teardown1, findAddress: findAddress1} = await runDockerCompose(
      path.join(__dirname, 'fixtures/docker-compose.yml'),
      {
        forceRecreate: true,
        env: {
          CONTENT_FOLDER: path.join(__dirname, 'fixtures/nginx-test-content'),
        },
      },
    )
    const {teardown: teardown2, findAddress: findAddress2} = await runDockerCompose(
      path.join(__dirname, 'fixtures/docker-compose.yml'),
      {
        forceRecreate: true,
        env: {
          CONTENT_FOLDER: path.join(__dirname, './fixtures/nginx-test-content-2'),
        },
      },
    )
    const {teardown: teardown3, findAddress: findAddress3} = await runDockerCompose(
      path.join(__dirname, 'fixtures/docker-compose.yml'),
      {
        forceRecreate: true,
        env: {
          CONTENT_FOLDER: path.join(__dirname, 'fixtures/nginx-test-content'),
        },
        variation: '2',
      },
    )

    await findAddress1('nginx', 80)
    await findAddress2('nginx', 80)
    await findAddress3('nginx', 80)

    await teardown3()
    await teardown2()
    await teardown1()
  })
})
