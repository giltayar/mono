import {runDockerCompose, tcpHealthCheck} from '@seasquared/docker-compose-testkit'
import {fetchAsJson} from '@seasquared/http-commons'
import {after, afterEach, before, describe, it} from '@seasquared/mocha-commons'
import chai from 'chai'
import chaiSubset from 'chai-subset'
import path from 'path'
import {createDbSchema} from '../../src/models/db-schema.js'
import {makeWebApp} from '../../src/templatetemplate.js'
import {
  addEntity,
  getEntity,
  listEntities,
  updateEntity,
  deleteEntity,
} from '../commons/entity-operations.js'
const {expect, use} = chai
use(chaiSubset)

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

  after(async () => process.env.FULL_TEST && (await app()?.close()))
  afterEach(() => pool()?.query(`DELETE FROM entity_table`))

  after(() => teardown()())

  it('should be healthy', async () => {
    expect(await fetchAsJson(new URL('/healthz', baseUrl()))).to.eql({})
  })

  it('should add and get entities', async () => {
    const start = Date.now()
    const {id: id1} = await addEntity(baseUrl(), entity1)
    const {id: id2} = await addEntity(baseUrl(), entity2)

    expect(id1).to.not.be.undefined
    expect(id2).to.not.be.undefined

    expect(await getEntity(id1, baseUrl())).to.containSubset({
      id: id1,
      lastModified: /**@param {string} x*/ (x) => new Date(x).getTime() >= start,
      ...entity1,
    })
    expect(await getEntity(id2, baseUrl())).to.containSubset({
      id: id2,
      lastModified: /**@param {string} x*/ (x) => new Date(x).getTime() >= start,
      ...entity2,
    })
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
})
