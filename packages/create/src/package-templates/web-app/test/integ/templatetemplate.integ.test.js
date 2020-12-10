import {runDockerCompose} from '@seasquared/docker-compose-testkit'
import {after, before, beforeEach, describe, it} from '@seasquared/mocha-commons'
import {initializeForTesting} from '@seasquared/pino-global'
import {loggerOptionsForRecorder, recordLogs} from '@seasquared/pino-testkit'
import {fetchAsJson} from '@seasquared/http-commons'
import chai from 'chai'
import chaiSubset from 'chai-subset'
import path from 'path'
import {makeWebApp} from '../../src/templatetemplate.js'
const {expect, use} = chai
use(chaiSubset)

initializeForTesting(loggerOptionsForRecorder)

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('templatetemplate (integ)', function () {
  const {teardown} = before(() =>
    runDockerCompose(path.resolve(__dirname, 'docker-compose.yaml'), {
      forceRecreate: !!process.env.FULL_TEST,
    }),
  )

  const {baseUrl, app} = before(async () => {
    const {app} = await makeWebApp({})

    return {
      baseUrl: await app.listen(0),
      app,
    }
  })

  beforeEach(recordLogs)

  after(async () => process.env.FULL_TEST && (await app()?.close()))

  after(() => teardown()())

  it('should do something cool', async () => {
    // real healthz test is in other file. This is just a placeholder for a test
    expect(await fetchAsJson(new URL('/healthz', baseUrl()))).to.eql({})
  })
})
