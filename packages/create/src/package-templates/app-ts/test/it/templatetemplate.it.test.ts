import path from 'path'
import {describe, it, before, after} from 'mocha'
import {expect} from 'chai'
import {fetchAsJson} from '@applitools/http-commons'
import {dockerComposeTool} from '@applitools/docker-compose-mocha'
import {createTestLogger} from '@applitools/loggly-pino'
import {
  getAddressForService,
  generateEnvVarsWithDependenciesVersions,
} from '@applitools/docker-compose-testkit'
const packageJson = require('../../package.json')

import createApp from '../../src/templatetemplate'

describe('templatetemplate (it)', function() {
  const composePath = path.join(__dirname, 'docker-compose.yml')
  const envName = dockerComposeTool(before, after, composePath, {
    shouldPullImages: !!process.env.NODE_ENV && process.env.NODE_ENV !== 'development',
    brutallyKill: true,
    envVars: {
      ...generateEnvVarsWithDependenciesVersions(packageJson),
    },
  })

  const {baseUrl} = setupApp()

  it('should return OK on /healthz', async () => {
    expect(await fetchAsJson(`${baseUrl()}/healthz`)).to.eql({version: packageJson.version})
  })

  it('should do something interesting...', async () => {
    // You can remove these two lines later
    const someService =
      false && (await getAddressForService(envName, composePath, 'some-service', 80))
    expect(someService).to.be.false

    expect(await fetchAsJson(`${baseUrl()}/healthz`)).to.eql({version: packageJson.version})
  })
})

function setupApp(): {baseUrl: () => string; address: () => string} {
  let app: any
  before(async () => {
    app = createApp({logger: createTestLogger()})

    await app.listen(0, 'localhost')
  })
  after(() => app.close())

  return {
    baseUrl: (): string => `http://localhost:${app.server.address().port}`,
    address: (): string => `localhost:${app.server.address().port}`,
  }
}
