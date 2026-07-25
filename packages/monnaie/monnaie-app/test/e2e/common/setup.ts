import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {version} from '../../../src/commons/version.ts'

export function setup(): {url: () => URL} {
  let teardown: () => Promise<void>
  let url: URL

  test.beforeAll(async () => {
    const dockerCompose = await runDockerCompose(
      new URL('../docker-compose.yml', import.meta.url),
      {
        containerCleanup: true,
        forceRecreate: true,
        env: {MONNAIE_APP_VERSION: version},
      },
    )
    teardown = dockerCompose.teardown

    const address = await dockerCompose.findAddress('monnaie-app', 3000)
    // Chromium blocks navigation to 0.0.0.0, which is what docker compose reports
    url = new URL(`http://${address.replace('0.0.0.0', '127.0.0.1')}`)
  })

  test.afterAll(async () => {
    await teardown?.()
  })

  return {url: () => url}
}
