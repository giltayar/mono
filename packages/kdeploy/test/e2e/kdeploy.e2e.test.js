import path from 'path'
import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
const {expect} = chai
import {setupKubernetes} from '@seasquared/kubernetes-testkit'
import {sh, shWithOutput} from '@seasquared/scripting-commons'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('kdeploy e2e', function () {
  it('should deploy a deployment package', async () => {
    const script = path.resolve(__dirname, '../../src/run-kdeploy.js')
    const {namespace, teardown} = await setupKubernetes(
      path.resolve(__dirname, 'fixtures/nothing-inside'),
    )

    await shWithOutput(
      `kubectl --namespace=${namespace} delete deployment nginx-deployment`,
    ).catch((err) => (err.stderr?.includes('not found') ? Promise.resolve() : Promise.reject(err)))

    const deploymentPackage = path.join(__dirname, 'fixtures/sample-deployment-package')

    await sh(`${script} generate --cluster e2e --name nginx`, {
      cwd: deploymentPackage,
    })

    await sh(
      `echo "some kinda message" | ${script} deploy --docker-desktop --namespace ${namespace} --rollout-version=3.4.5`,
      {cwd: deploymentPackage},
    )

    expect(
      await shWithOutput(
        `kubectl --namespace ${namespace} rollout history deploy nginx-deployment`,
      ),
    ).to.match(/1.*3\.4\.5\: some kinda message/)

    await teardown()
  })
})
