import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
const {expect} = chai
import {setupKubernetes} from '@seasquared/kubernetes-testkit'
import {shWithOutput} from '@seasquared/scripting-commons'
import path from 'path'

import {app} from '../../src/kdeploy.js'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('deploy (integ)', function () {
  it('should deploy a deployment and a service', async () => {
    const {findAddress, namespace, teardown} = await setupKubernetes(
      path.resolve(__dirname, 'fixtures/nothing-inside'),
    )

    await shWithOutput(
      `kubectl --namespace=${namespace} delete service nginx-service`,
    ).catch((err) => (err.stderr?.includes('not found') ? Promise.resolve() : Promise.reject(err)))

    await shWithOutput(
      `kubectl --namespace=${namespace} delete deployment nginx-deployment`,
    ).catch((err) => (err.stderr?.includes('not found') ? Promise.resolve() : Promise.reject(err)))

    await app([
      'deploy',
      '--docker-desktop',
      '--input',
      path.resolve(__dirname, 'fixtures/nginx-deploy-and-service'),
      '--namespace',
      namespace,
      '--message=some message',
      '--rollout-version=1.2.1',
    ])

    await findAddress('nginx-service')

    expect(
      await shWithOutput(
        `kubectl --namespace ${namespace} rollout history deploy nginx-deployment`,
      ),
    ).to.match(/1.*1\.2\.1\: some message/)

    // deployment doesnt change, so rollout message shouldn't change
    await app([
      'deploy',
      '--docker-desktop',
      '--input',
      path.resolve(__dirname, 'fixtures/nginx-deploy-and-service'),
      '--namespace',
      namespace,
      '--message=another message',
      '--rollout-version=2.2.1',
    ])

    expect(
      await shWithOutput(
        `kubectl --namespace ${namespace} rollout history deploy nginx-deployment`,
      ),
    ).to.not.include('another message')

    // now change deployment and check that there's a new revision
    await app([
      'deploy',
      '--docker-desktop',
      '--input',
      path.resolve(__dirname, 'fixtures/nginx-deploy-and-service-slightly-different'),
      '--namespace',
      namespace,
      '--message=changed message',
      '--rollout-version=3.2.1',
    ])

    expect(
      await shWithOutput(
        `kubectl --namespace ${namespace} rollout history deploy nginx-deployment`,
      ),
    )
      .to.match(/1.*1\.2\.1\: some message/)
      .and.to.match(/2.*3\.2\.1\: changed message/)

    await teardown()
  })
})
