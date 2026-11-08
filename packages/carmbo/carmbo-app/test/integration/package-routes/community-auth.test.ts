import {expect, test} from '@playwright/test'
import {generateKeyPairSync} from 'node:crypto'
import {setup} from '../common/setup.ts'

const {privateKey} = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {type: 'spki', format: 'pem'},
  privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
})

const {url} = setup(import.meta.url, {
  withCommunities: true,
  firebase: {
    apiKey: 'community-auth-test',
    serviceAccountJson: JSON.stringify({
      projectId: 'community-auth-test',
      clientEmail: 'firebase-admin@test.invalid',
      privateKey,
    }),
  },
})

test('community routes require login when Firebase authentication is enabled', async ({
  request,
}) => {
  for (const {method, path, form} of [
    {method: 'GET', path: '/communities'},
    {method: 'GET', path: '/communities/new'},
    {method: 'GET', path: '/communities/1'},
    {
      method: 'GET',
      path: '/communities/1/by-history/00000000-0000-4000-8000-000000000000',
    },
    {method: 'POST', path: '/communities/', form: {name: 'Blocked', description: ''}},
    {method: 'PUT', path: '/communities/1', form: {name: 'Blocked', description: ''}},
    {method: 'DELETE', path: '/communities/1?delete-operation=delete'},
    {method: 'GET', path: '/communities/1/members/1'},
    {
      method: 'GET',
      path: '/communities/1/members/1/state?knownHistoryId=00000000-0000-4000-8000-000000000000',
    },
    {method: 'GET', path: '/emails'},
    {method: 'GET', path: '/emails/1'},
    {method: 'GET', path: '/emails/1/html'},
    {method: 'GET', path: '/emails/templates'},
    {method: 'GET', path: '/emails/templates/new'},
    {method: 'GET', path: '/emails/templates/1'},
    {method: 'GET', path: '/emails/templates/style.css'},
    {method: 'GET', path: '/emails/templates/assets/1.1.1/editor.js'},
    {method: 'GET', path: '/emails/templates/assets/1.1.1/editor.css'},
    {
      method: 'GET',
      path: '/emails/templates/1/by-history/00000000-0000-4000-8000-000000000000',
    },
    {method: 'POST', path: '/emails/templates/', form: {name: 'Blocked'}},
    {method: 'PUT', path: '/emails/templates/1', form: {name: 'Blocked'}},
    {method: 'DELETE', path: '/emails/templates/1?delete-operation=delete'},
    {method: 'POST', path: '/emails/templates/new/preview', form: {name: 'Blocked'}},
    {method: 'POST', path: '/emails/templates/new/send-preview', form: {name: 'Blocked'}},
  ]) {
    const response = await request.fetch(new URL(path, url()).href, {
      method,
      form,
      maxRedirects: 0,
    })
    expect(response.status(), `${method} ${path}`).toBe(302)
    expect(response.headers().location).toBe('/auth/login')
  }

  const health = await request.get(new URL('/health', url()).href)
  expect(health.status()).toBe(200)

  // Resend cannot log in: the webhook is public and authenticated by its signature instead.
  const webhook = await request.post(new URL('/api/emails/resend/webhook', url()).href, {
    headers: {'content-type': 'application/json'},
    data: '{}',
    maxRedirects: 0,
  })
  expect(webhook.status()).toBe(400)
  expect(await webhook.json()).toEqual({error: 'Invalid webhook signature'})
})
