import path from 'path'
import {runDockerCompose, tcpHealthCheck} from '@seasquared/docker-compose-testkit'
import {after, afterEach, before, describe, it} from '@seasquared/mocha-commons'
import chaiSubset from 'chai-subset'
import chai from 'chai'
import {createDbSchema} from '../../src/models/db-schema.js'
import {connectToPostgres} from '../../src/templatetemplate.js'
import {addEntity, listEntities} from '../commons/entity-operations.js'
const {expect, use} = chai
use(chaiSubset)

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('templatetemplate (e2e)', function () {
  const {findAddress, teardown} = before(() =>
    runDockerCompose(path.resolve(__dirname, 'docker-compose.yaml'), {
      forceRecreate: !!process.env.FULL_TEST,
      env: {
        npm_package_version: process.env.npm_package_version,
      },
    }),
  )
  const {baseUrl, pool} = before(async () => {
    const postgresAddress = await findAddress()('postgres', 5432, {healthCheck: tcpHealthCheck})
    const appAddress = await findAddress()('app', 80)

    const pool = await connectToPostgres(`postgres://postgres:password@${postgresAddress}/postgres`)
    await createDbSchema(pool)

    return {
      baseUrl: `http://${appAddress}/`,
      pool,
    }
  })

  afterEach(() => pool()?.query(`DELETE FROM entity_table`))

  after(() => teardown()())

  it('should add and list entities', async () => {
    const entity1 = {
      name: 'name1',
      value: 3,
      data: {
        more: 4,
        stuff: 'stuff1',
      },
    }

    expect(await listEntities(baseUrl())).to.have.length(0)

    await addEntity(baseUrl(), entity1)

    expect(await listEntities(baseUrl())).to.have.length(1)
  })
})
