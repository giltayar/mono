import assert from 'node:assert/strict'
import {test} from 'node:test'
import {EnvironmentVariablesSchema} from '../../../src/app/environment.ts'

const required = {
  GREEN_API_KEY: 'green-key',
  GREEN_API_INSTANCE: '1',
  CARMBO_FIREBASE_API_KEY: 'firebase-key',
  CARMBO_FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
  CARMBO_API_SECRET: 'api-secret',
  CARDCOM_API_KEY: 'cardcom-key',
  CARDCOM_API_KEY_PASSWORD: 'cardcom-password',
}

const communities = {
  WITH_COMMUNITIES: 'true',
  APP_BASE_URL: 'https://carmbo.example.com',
  RESEND_API_KEY: 're_test',
  RESEND_FROM: 'Carmbo <hello@example.com>',
}

function issuePaths(environment: Record<string, string | undefined>) {
  const result = EnvironmentVariablesSchema.safeParse(environment)
  return result.success ? [] : result.error.issues.map((issue) => issue.path)
}

test('communities require APP_BASE_URL to be the public https URL of the app', () => {
  for (const appBaseUrl of [undefined, '', 'http://carmbo.example.com', 'https://']) {
    assert.deepEqual(
      issuePaths({...required, ...communities, APP_BASE_URL: appBaseUrl}),
      [['APP_BASE_URL']],
      `APP_BASE_URL=${appBaseUrl}`,
    )
  }
})

test('communities require the Resend API key and sender', () => {
  for (const name of ['RESEND_API_KEY', 'RESEND_FROM']) {
    for (const value of [undefined, '', ' ']) {
      assert.deepEqual(issuePaths({...required, ...communities, [name]: value}), [[name]])
    }
  }
  const valid = EnvironmentVariablesSchema.parse({...required, ...communities})
  assert.equal(valid.APP_BASE_URL, 'https://carmbo.example.com')
  assert.equal(valid.RESEND_FROM, 'Carmbo <hello@example.com>')
})

test('without communities, the URL and Resend settings stay optional', () => {
  assert.deepEqual(issuePaths(required), [])
  assert.deepEqual(issuePaths({...required, WITH_COMMUNITIES: 'false'}), [])
})
