import {test} from '@playwright/test'
import type {FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'
import {makeApp} from '../../../src/app/monnaie-app.ts'

export function setup(): {url: () => URL} {
  let app: FastifyInstance
  let url: URL

  test.beforeAll(async () => {
    app = makeApp()

    await app.listen({port: 0, host: '127.0.0.1'})

    const {port} = app.server.address() as AddressInfo
    url = new URL(`http://127.0.0.1:${port}`)
  })

  test.afterAll(async () => {
    await app?.close()
  })

  return {url: () => url}
}
