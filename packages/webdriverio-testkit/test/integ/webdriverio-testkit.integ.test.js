import {describe, it} from 'mocha'
import {expect, use} from 'chai'
import chaiSubset from 'chai-subset'
import fastify from 'fastify'
import {presult} from '@seasquared/promise-commons'
import {
  automateBrowserWithWebdriverIO,
  openUrlAndAwaitPageLoad,
  getTextForSelector,
} from '../../src/webdriverio-testkit.js'

use(chaiSubset)

describe('webdriverio-testkit (integ)', function () {
  it('should start webdriverio docker session and tear it down', async () => {
    const app = fastify()
    app.get('/hello', async (_req, res) => {
      res.type('text/html')
      return `<html><body><h1>Hello, world</h1></body></html>`
    })
    const baseUrl = await app.listen({port: 0, host: '0.0.0.0'})

    const {browser, teardown} = await automateBrowserWithWebdriverIO(baseUrl, {
      browser: process.env.BROWSER,
      callerFilename: import.meta.url,
    })

    await openUrlAndAwaitPageLoad(browser, '/hello')

    expect(await getTextForSelector(browser, 'h1')).to.equal('Hello, world')

    await teardown()

    app.close().then(() => 1, console.log)
  })

  it('should start webdriverio local firefox session and tear it down', async () => {
    const {browser, teardown} = await automateBrowserWithWebdriverIO('https://example.com', {
      browser: 'firefox',
    })

    await openUrlAndAwaitPageLoad(browser, '/')

    expect(await getTextForSelector(browser, 'h1')).to.equal('Example Domain')

    await teardown()

    expect(await presult(browser.$('h1'))).to.containSubset([
      {
        code: /**
         * @param {string} c
         */ (c) => ['ECONNRESET', 'ECONNREFUSED'].includes(c),
      },
    ])
  })

  it('should start webdriverio local chrome session and tear it down', async () => {
    const {browser, teardown} = await automateBrowserWithWebdriverIO('https://example.com', {
      browser: 'chrome',
    })

    await openUrlAndAwaitPageLoad(browser, '/')

    expect(await getTextForSelector(browser, 'h1')).to.equal('Example Domain')

    await teardown()
  })
})
