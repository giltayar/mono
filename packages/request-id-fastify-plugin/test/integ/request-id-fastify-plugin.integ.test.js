import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
import fastify from 'fastify'
import {fetchAsJson} from '@seasquared/http-commons'
import chaiSubset from 'chai-subset'
import {validate} from 'uuid'
const {expect, use} = chai
use(chaiSubset)

import plugin from '../../src/request-id-fastify-plugin.js'

describe('request-id-fastify-plugin (integ)', function () {
  it('should decorate request with a new requestid', async () => {
    const app = fastify()
    app.register(plugin, {})
    app.all('/url', async (req) => {
      return {requestId: req.requestId}
    })
    const baseUrl = await app.listen(0)

    const {requestId} = /**@type{{requestId: string}}*/ (await fetchAsJson(
      new URL('/url', baseUrl),
    ))
    expect(requestId).to.satisfy(validate)

    app.close().then(() => 1, console.log)
  })

  it('should decorate request with an existing requestid', async () => {
    const app = fastify()
    app.register(plugin, {})
    app.all('/url', async (req) => {
      return {requestId: req.requestId}
    })
    const baseUrl = await app.listen(0)

    const {requestId} = /**@type{{requestId: string}}*/ (await fetchAsJson(
      new URL('/url', baseUrl),
      {
        headers: {'x-request-id': 'a-request-id'},
      },
    ))
    expect(requestId).to.equal('a-request-id')

    app.close().then(() => 1, console.log)
  })
})
