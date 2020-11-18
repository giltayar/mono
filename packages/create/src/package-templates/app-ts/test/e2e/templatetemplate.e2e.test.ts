import path from 'path'
import {describe, it, before, after} from 'mocha'
import {expect} from 'chai'
import {fetchAsJson} from '@applitools/http-commons'
import {dockerComposeTool} from '@applitools/docker-compose-mocha'
import {
  getAddressForService,
  generateEnvVarsWithDependenciesVersions,
} from '@applitools/docker-compose-testkit'
const packageJson = require('../../package.json')

describe('templatetemplate (e2e)', function() {
  const composePath = path.join(__dirname, 'docker-compose.yml')
  const envName = dockerComposeTool(before, after, composePath, {
    shouldPullImages: !!process.env.NODE_ENV && process.env.NODE_ENV !== 'development',
    brutallyKill: true,
    envVars: {
      ...generateEnvVarsWithDependenciesVersions(packageJson),
    },
  })

  it('should return OK on /healthz', async () => {
    const appAddress = await getAddressForService(envName, composePath, 'app', 80)

    expect(await fetchAsJson(`http://${appAddress}/healthz`)).to.eql({version: packageJson.version})
  })
})
