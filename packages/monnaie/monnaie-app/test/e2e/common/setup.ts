import process from 'node:process'
import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {version} from '../../../src/commons/version.ts'

/**
 * The end-to-end test runs the published image, which talks to the real Firebase, so unlike the
 * integration tests it cannot be handed a fake. These are the credentials it needs to run at all.
 */
export type FirebaseCredentials = {
  apiKey: string
  serviceAccount: string
  email: string
  password: string
}

export function firebaseCredentials(): FirebaseCredentials | undefined {
  const {
    MONNAIE_FIREBASE_API_KEY: apiKey,
    MONNAIE_FIREBASE_SERVICE_ACCOUNT: serviceAccount,
    MONNAIE_FIREBASE_TEST_EMAIL: email,
    MONNAIE_FIREBASE_TEST_PASSWORD: password,
  } = process.env

  if (
    apiKey === undefined ||
    serviceAccount === undefined ||
    email === undefined ||
    password === undefined
  ) {
    return undefined
  }

  return {apiKey, serviceAccount, email, password}
}

export function setup(credentials: () => FirebaseCredentials): {url: () => URL} {
  let teardown: () => Promise<void>
  let url: URL

  test.beforeAll(async () => {
    const {apiKey, serviceAccount} = credentials()

    const dockerCompose = await runDockerCompose(
      new URL('../docker-compose.yaml', import.meta.url),
      {
        containerCleanup: true,
        forceRecreate: true,
        env: {
          MONNAIE_APP_VERSION: version,
          MONNAIE_FIREBASE_API_KEY: apiKey,
          MONNAIE_FIREBASE_SERVICE_ACCOUNT: serviceAccount,
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

  return {url: () => url}
}
