'use strict'
const path = require('path')
const {
  describe = global.describe,
  it = global.it,
  before = global.before,
  after = global.after,
} = require('mocha')
const {expect} = require('chai')
const fetch = require('node-fetch')
const {dockerComposeTool} = require('@applitools/docker-compose-mocha')
const {
  getAddressForService,
  generateEnvVarsWithDependenciesVersions,
} = require('@applitools/docker-compose-testkit')

describe('templatetemplate e2e', function() {
  const composePath = path.join(__dirname, 'docker-compose.yml')
  const envName = dockerComposeTool(before, after, composePath, {
    shouldPullImages: !!process.env.NODE_ENV && process.env.NODE_ENV !== 'development',
    brutallyKill: true,
    envVars: generateEnvVarsWithDependenciesVersions(require('../../package.json')),
  })

  it('should return OK on /', async () => {
    const appAddress = await getAddressForService(envName, composePath, 'app', 80)
    const response = await fetch(`http://${appAddress}/`)
    expect(response.status).to.equal(200)
    const json = await response.json()
    expect(json.hello).to.equal('codeless')
  })
})
