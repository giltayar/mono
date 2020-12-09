import mocha from 'mocha'
const {describe, it, beforeEach} = mocha
import {presult} from '@seasquared/promise-commons'
import chai from 'chai'
import fastify from 'fastify'
import {fetchAsJson} from '@seasquared/http-commons'
import pino from 'pino'
import chaiSubset from 'chai-subset'
import {loggerOptionsForRecorder, playbackLogs, recordLogs} from '@seasquared/pino-testkit'
const {expect, use} = chai
use(chaiSubset)

import plugin from '../../src/log-request-fastify-plugin.js'

describe('log-request-fastify-plugin (integ)', function () {
  beforeEach(recordLogs)

  it('should log requests', async () => {
    const logger = pino(loggerOptionsForRecorder)

    const app = fastify()
    app.register(plugin, {logger})
    app.all('/good', async () => ({a: 4}))
    const baseUrl = await app.listen(0)

    const result = await fetchAsJson(new URL('/good', baseUrl))
    expect(result).to.eql({a: 4})

    expect(playbackLogs())
      .to.have.length(1)
      .and.to.containSubset([
        {
          method: 'GET',
          statusCode: 200,
          event: 'request-handled',
          url: '/good',
          success: true,
        },
      ])

    app.close().then(() => 1, console.log)
  })

  it('should log POST requests', async () => {
    const logger = pino(loggerOptionsForRecorder)

    const app = fastify()
    app.register(plugin, {logger})
    app.all('/good', async () => ({a: 4}))
    const baseUrl = await app.listen(0)

    const result = await fetchAsJson(new URL('/good', baseUrl), {method: 'POST'})
    expect(result).to.eql({a: 4})

    expect(playbackLogs())
      .to.have.length(1)
      .and.to.containSubset([
        {
          method: 'POST',
          statusCode: 200,
          event: 'request-handled',
          url: '/good',
          success: true,
        },
      ])

    app.close().then(() => 1, console.log)
  })

  it('should log bad requests', async () => {
    const logger = pino(loggerOptionsForRecorder)

    const app = fastify()
    app.register(plugin, {logger})

    app.all('/bad', async () => {
      throw new Error('wicked zoot!')
    })

    const baseUrl = await app.listen(0)

    const [error] = await presult(fetchAsJson(new URL('/bad', baseUrl)))
    expect(error).to.be.instanceOf(Error)

    expect(playbackLogs())
      .to.have.length(1)
      .and.to.containSubset([
        {
          method: 'GET',
          statusCode: 500,
          event: 'request-handled',
          url: '/bad',
          success: false,
          error: /**@param{string} e*/ (e) => e.includes('wicked zoot!'),
        },
      ])
    app.close().then(() => 1, console.log)
  })

  it('should log status code', async () => {
    const logger = pino(loggerOptionsForRecorder)

    const app = fastify()
    app.register(plugin, {logger})

    app.all(
      '/status',
      /**
       * @param {import('fastify').FastifyRequest<{Querystring: {status: string}}>} req
       * @param {import('fastify').FastifyReply} reply
       */
      async (req, reply) => {
        reply.status(parseInt(req.query.status, 10))

        return {a: 4}
      },
    )

    const baseUrl = await app.listen(0)

    const [error] = await presult(fetchAsJson(new URL('/status?status=399', baseUrl)))
    expect(error).to.be.instanceOf(Error)

    expect(playbackLogs())
      .to.have.length(1)
      .and.to.containSubset([
        {
          method: 'GET',
          statusCode: 399,
          event: 'request-handled',
          url: '/status?status=399',
          success: true,
        },
      ])
    app.close().then(() => 1, console.log)
  })
})
