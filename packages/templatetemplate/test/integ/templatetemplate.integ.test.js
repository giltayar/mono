import {runDockerCompose, tcpHealthCheck} from '@seasquared/docker-compose-testkit'
import {fetchAsJson} from '@seasquared/http-commons'
import {after, afterEach, before, beforeEach, describe, it} from '@seasquared/mocha-commons'
import {initializeForTesting} from '@seasquared/pino-global'
import {loggerOptionsForRecorder, playbackLogs, recordLogs} from '@seasquared/pino-testkit'
import {presult} from '@seasquared/promise-commons'
import chai from 'chai'
import chaiSubset from 'chai-subset'
import path from 'path'
import {v4 as uuid, validate} from 'uuid'
import {createDbSchema} from '../../src/models/db-schema.js'
import {makeWebApp} from '../../src/templatetemplate.js'
import {
  addEntity,
  deleteEntity,
  getEntity,
  listEntities,
  updateEntity,
} from '../commons/entity-operations.js'
const {expect, use} = chai
use(chaiSubset)

initializeForTesting(loggerOptionsForRecorder)

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('templatetemplate (integ)', function () {
  const entity1 = {
    name: 'name1',
    value: 3,
    data: {
      more: 4,
      stuff: 'stuff1',
    },
  }
  const entity2 = {
    name: 'name10',
    value: 30,
    data: {
      more: 40,
      stuff: 'stuff10',
    },
  }

  const {findAddress, teardown} = before(() =>
    runDockerCompose(path.resolve(__dirname, 'docker-compose.yaml'), {
      forceRecreate: !!process.env.FULL_TEST,
    }),
  )

  const {baseUrl, app, pool} = before(async () => {
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
  afterEach(() => pool()?.query(`DELETE FROM entity_table`))

  after(() => teardown()())

  it('should be healthy', async () => {
    expect(await fetchAsJson(new URL('/healthz', baseUrl()))).to.eql({})
  })

  it('should add and get entities', async () => {
    const start = Date.now()
    const {id: id1} = await addEntity(baseUrl(), entity1)
    expect(playbackLogs())
      .to.have.length(1)
      .and.to.containSubset([{method: 'POST', statusCode: 200, success: true, requestId: validate}])
    const {id: id2} = await addEntity(baseUrl(), entity2)

    expect(id1).to.not.be.undefined
    expect(id2).to.not.be.undefined

    expect(await getEntity(baseUrl(), id1)).to.containSubset({
      id: id1,
      lastModified: /**@param {string} x*/ (x) => new Date(x).getTime() >= start,
      ...entity1,
    })
    expect(await getEntity(baseUrl(), id2)).to.containSubset({
      id: id2,
      lastModified: /**@param {string} x*/ (x) => new Date(x).getTime() >= start,
      ...entity2,
    })
  })

  it('should return 404 on get unknown entity', async () => {
    const [err] = await presult(getEntity(baseUrl(), uuid()))

    expect(err.status).to.equal(404)
    expect(playbackLogs())
      .to.have.length(1)
      .and.to.containSubset([{method: 'GET', statusCode: 404, success: true, requestId: validate}])
  })

  it('should fail with 400 on add bad entity', async () => {
    const [err] = await presult(
      // @ts-expect-error
      addEntity(baseUrl(), {...entity1, value: 'this-should-be-a-number'}),
    )

    expect(err.status).to.equal(400)
    expect(playbackLogs())
      .to.have.length(1)
      .and.to.containSubset([{method: 'POST', statusCode: 400, success: true, requestId: validate}])
  })

  it('should list entities', async () => {
    const start = Date.now()
    const {id: id1} = await addEntity(baseUrl(), entity1)
    const {id: id2} = await addEntity(baseUrl(), entity2)

    expect(await listEntities(baseUrl())).to.containSubset([
      {
        id: id1,
        lastModified: /**@param {string} x*/ (x) => new Date(x).getTime() >= start,
        ...entity1,
      },
      {
        id: id2,
        lastModified: /**@param {string} x*/ (x) => new Date(x).getTime() >= start,
        ...entity2,
      },
    ])
  })

  it('should update entities', async () => {
    const start = Date.now()
    const {id: id1} = await addEntity(baseUrl(), entity1)
    const {id: id2} = await addEntity(baseUrl(), entity2)

    const updateTime = Date.now()

    await updateEntity(baseUrl(), id1, {...entity1, value: 33})

    expect(await listEntities(baseUrl())).to.containSubset([
      {
        id: id1,
        lastModified: /**@param {string} x*/ (x) => new Date(x).getTime() >= updateTime,
        ...entity1,
        value: 33,
      },
      {
        id: id2,
        lastModified: /**@param {string} x*/ (x) =>
          new Date(x).getTime() >= start && new Date(x).getTime() <= updateTime,
        ...entity2,
      },
    ])
  })

  it('should return 404 on update unknownn entity', async () => {
    const [err] = await presult(updateEntity(baseUrl(), uuid(), entity1))

    expect(err.status).to.equal(404)
  })

  it('should delete entities', async () => {
    const start = Date.now()
    const {id: id1} = await addEntity(baseUrl(), entity1)
    const {id: id2} = await addEntity(baseUrl(), entity2)

    await deleteEntity(baseUrl(), id2)

    expect(await listEntities(baseUrl())).to.containSubset([
      {
        id: id1,
        lastModified: /**@param {string} x*/ (x) => new Date(x).getTime() >= start,
        ...entity1,
      },
    ])
  })

  it('should return 404 on delete unknownn entity', async () => {
    const [err] = await presult(deleteEntity(baseUrl(), uuid()))

    expect(err.status).to.equal(404)
  })
})
