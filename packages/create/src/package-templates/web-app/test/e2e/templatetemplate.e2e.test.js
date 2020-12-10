import path from 'path'
import {runDockerCompose} from '@seasquared/docker-compose-testkit'
import {after, before, describe, it} from '@seasquared/mocha-commons'
import {fetchAsJson} from '@seasquared/http-commons'
import chaiSubset from 'chai-subset'
import chai from 'chai'
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
  const {baseUrl} = before(async () => {
    const appAddress = await findAddress()('app', 80)

    return {baseUrl: `http://${appAddress}/`}
  })

  after(() => teardown()())

  it('should be healthy', async () => {
    expect(await fetchAsJson(new URL('/healthz', baseUrl()))).to.eql({})
  })
})
