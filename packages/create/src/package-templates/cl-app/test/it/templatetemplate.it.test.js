'use strict'
const path = require('path')
const {
  describe = global.describe,
  it = global.it,
  before = global.before,
  after = global.after,
} = require('mocha')
const {expect} = require('chai')
const {fetchAsJson} = require('@applitools/http-commons')
const {dockerComposeTool} = require('@applitools/docker-compose-mocha')
const {
  getAddressForService,
  generateEnvVarsWithDependenciesVersions,
} = require('@applitools/docker-compose-testkit')
const logger = require('@applitools/loggly-pino').createTestLogger()

const app = require('../..')

describe('templatetemplate it', function() {
  const composePath = path.join(__dirname, 'docker-compose.yml')
  const envName = dockerComposeTool(before, after, composePath, {
    shouldPullImages: !!process.env.NODE_ENV && process.env.NODE_ENV !== 'development',
    brutallyKill: true,
    envVars: generateEnvVarsWithDependenciesVersions(require('../../package.json')),
  })

  const {baseUrl} = setupApp()

  it('should return OK on /', async () => {
    const json = await fetchAsJson(`${baseUrl()}/`)
    expect(json.hello).to.equal('codeless')
  })

  it('should do something interesting...', async () => {
    // You can remove these two lines later
    const someService =
      false && (await getAddressForService(envName, composePath, 'some-service', 80))
    expect(someService).to.be.false
    const json = await fetchAsJson(`${baseUrl()}/`)
    expect(json.hello).to.equal('codeless')
  })
})

function setupApp() {
  let server, appInst

  before(async () => {
    appInst = await app({logger})
    await appInst.listen()
    await appInst.ready()
    server = appInst.server
  })
  after(done => appInst.close(done))

  return {
    baseUrl: () => `http://localhost:${server.address().port}`,
    address: () => `localhost:${server.address().port}`,
  }
}
