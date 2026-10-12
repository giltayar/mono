import {expect, test} from '@playwright/test'
import {generateKeyPairSync} from 'node:crypto'
import {setup} from '../common/setup.ts'

const {privateKey} = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {type: 'spki', format: 'pem'},
  privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
})

const {url} = setup(import.meta.url, {
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
})
