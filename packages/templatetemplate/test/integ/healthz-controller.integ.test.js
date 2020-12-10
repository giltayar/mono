import {runDockerCompose, tcpHealthCheck} from '@seasquared/docker-compose-testkit'
import {fetchAsJson} from '@seasquared/http-commons'
import {after, before, beforeEach, describe, it} from '@seasquared/mocha-commons'
import {initializeForTesting} from '@seasquared/pino-global'
import {loggerOptionsForRecorder, playbackLogs, recordLogs} from '@seasquared/pino-testkit'
import chai from 'chai'
import chaiSubset from 'chai-subset'
import path from 'path'
import {validate} from 'uuid'
import {createDbSchema} from '../../src/models/db-schema.js'
import {makeWebApp} from '../../src/templatetemplate.js'
const {expect, use} = chai
use(chaiSubset)

initializeForTesting(loggerOptionsForRecorder)

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('healthz-controller (integ)', function () {
  const {findAddress, teardown} = before(() =>
    runDockerCompose(path.resolve(__dirname, 'docker-compose.yaml'), {
      forceRecreate: !!process.env.FULL_TEST,
      variation: __filename,
    }),
  )

  const {baseUrl, app} = before(async () => {
    const postgresAddress = await findAddress()('postgres', 5432, {healthCheck: tcpHealthCheck})
    const {app, pool} = await makeWebApp({
      postgresConnectionString: `postgres://postgres:password@${postgresAddress}/postgres`,
    })

    await createDbSchema(pool)

    return {
      baseUrl: await app.listen(0),
      app,
      pool,
    }
  })

  beforeEach(recordLogs)

  after(async () => process.env.FULL_TEST && (await app()?.close()))

  after(() => teardown()())

  it('should be healthy and have correct request logging', async () => {
    expect(await fetchAsJson(new URL('/healthz', baseUrl()))).to.eql({})
    expect(playbackLogs())
      .to.have.length(1)
      .and.to.containSubset([{statusCode: 200, requestId: validate}])
  })
})