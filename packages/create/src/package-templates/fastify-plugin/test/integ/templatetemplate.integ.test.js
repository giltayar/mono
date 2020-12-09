import mocha from 'mocha'
const {describe, it} = mocha
import {presult} from '@seasquared/promise-commons'
import chai from 'chai'
import fastify from 'fastify'
import {fetchAsJson} from '@seasquared/http-commons'
import chaiSubset from 'chai-subset'
const {expect, use} = chai
use(chaiSubset)

import plugin from '../../src/templatetemplate.js'

describe('templatetemplate (integ)', function () {
  it('should decorate requests', async () => {
    const app = fastify()
    app.register(plugin, {decoratorText: 'decorated!', targetStatus: 200})
    app.all('/url', async (req) => {
      return {decorated: req.decorated}
    })
    const baseUrl = await app.listen(0)

    const result = await fetchAsJson(new URL('/url', baseUrl))
    expect(result).to.eql({decorated: 'decorated!'})

    app.close().then(() => 1, console.log)
  })

  it('should translate 418', async () => {
    const app = fastify()
    app.register(plugin, {decoratorText: '', targetStatus: 419})
    app.all('/url', async (req, reply) => {
      reply.status(418)
      return {decorated: req.decorated}
    })
    const baseUrl = await app.listen(0)

    const [error] = await presult(fetchAsJson(new URL('/url', baseUrl)))
    expect(error.status).to.equal(419)

    app.close().then(() => 1, console.log)
  })
})
