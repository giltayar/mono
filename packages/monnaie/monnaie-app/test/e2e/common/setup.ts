import process from 'node:process'
import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import * as z from 'zod'
import {version} from '../../../src/commons/version.ts'

const EnvironmentVariablesSchema = z.object({
  /** The whole service account JSON of the firebase project, as downloaded from its console */
  MONNAIE_FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  MONNAIE_FIREBASE_API_KEY: z.string().min(1),
  /** A user that exists in that firebase project, and exists only for these tests */
  MONNAIE_E2E_EMAIL: z.string().min(1),
  MONNAIE_E2E_PASSWORD: z.string().min(1),
})

// these tests sign in against the real identity provider, so there is no point in pretending they
// could run without one: fail immediately, naming what is missing without printing any of it
const parsedEnvironment = EnvironmentVariablesSchema.safeParse(process.env)

if (!parsedEnvironment.success) {
  throw new Error(
    'the e2e tests need these environment variables to be set: ' +
      parsedEnvironment.error.issues.map((issue) => issue.path.join('.')).join(', '),
  )
}

const environment = parsedEnvironment.data

export function setup(): {url: () => URL; testUser: {email: string; password: string}} {
  let teardown: () => Promise<void>
  let url: URL

  test.beforeAll(async () => {
    const dockerCompose = await runDockerCompose(
      new URL('../docker-compose.yaml', import.meta.url),
      {
        containerCleanup: true,
        forceRecreate: true,
        env: {
          MONNAIE_APP_VERSION: version,
          MONNAIE_FIREBASE_SERVICE_ACCOUNT_JSON: environment.MONNAIE_FIREBASE_SERVICE_ACCOUNT_JSON,
          MONNAIE_FIREBASE_API_KEY: environment.MONNAIE_FIREBASE_API_KEY,
        },
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

  return {
    url: () => url,
    testUser: {
      email: environment.MONNAIE_E2E_EMAIL,
      password: environment.MONNAIE_E2E_PASSWORD,
    },
  }
}
