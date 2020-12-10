import {fetchAsJson} from '@seasquared/http-commons'
import logRequestFastifyPlugin from '@seasquared/log-request-fastify-plugin'
import makeLogger, {initializeForTesting} from '@seasquared/pino-global'
import {loggerOptionsForRecorder, playbackLogs, recordLogs} from '@seasquared/pino-testkit'
import {presult} from '@seasquared/promise-commons'
import requestIdFastifyPlugin from '@seasquared/request-id-fastify-plugin'
import chai from 'chai'
import chaiSubset from 'chai-subset'
import fastify from 'fastify'
import mocha from 'mocha'
import {validate} from 'uuid'
import plugin from '../../src/request-id-logger-fastify-plugin.js'
const {describe, it, beforeEach} = mocha
const {expect, use} = chai
use(chaiSubset)

initializeForTesting(loggerOptionsForRecorder)

describe('request-id-logger-fastify-plugin (integ)', function () {
  beforeEach(recordLogs)
  it('should log with requestId', async () => {
    const logger = makeLogger()
    const app = fastify()
    app.register(requestIdFastifyPlugin, {})
    app.register(logRequestFastifyPlugin, {logger})
    app.register(plugin, {logger})
    app.all('/url', async () => {
      logger.info({a: 4})
      return {}
    })
    const baseUrl = await app.listen(0)

    const result = await fetchAsJson(new URL('/url', baseUrl))
    expect(result).to.eql({})

    expect(playbackLogs())
      .to.have.length(2)
      .and.to.containSubset([
        {a: 4, requestId: validate},
        {requestId: validate, event: 'request-handled', url: '/url'},
      ])

    const requestIds = playbackLogs().map((l) => l.requestId)
    expect(requestIds[0]).to.equal(requestIds[1])

    app.close().then(() => 1, console.log)
  })

  it('should fail if no "requestId" decorator exists', async () => {
    const logger = makeLogger()
    const app = fastify()
    app.register(plugin, {logger})
    expect((await presult(app.listen(0)))[0]).to.satisfy(
      /**
       * @param {Error} err
       */
      (err) => expect(err.message).to.include("'requestId' is not present"),
    )
  })
})
