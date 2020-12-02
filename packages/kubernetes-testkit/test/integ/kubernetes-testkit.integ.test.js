import {fetchAsText} from '@seasquared/http-commons'
import {presult} from '@seasquared/promise-commons'
import {shWithOutput} from '@seasquared/scripting-commons'
import chai from 'chai'
import chaiSubset from 'chai-subset'
import mocha from 'mocha'
import path from 'path'
import {setupKubernetes, tcpHealthCheck} from '../../src/kubernetes-testkit.js'
const {describe, it} = mocha
const {expect, use} = chai
use(chaiSubset)
const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('kubernetes-testkit (integ)', function () {
  it('should work', async () => {
    const nginxConfigurations = path.resolve(__dirname, 'fixtures/nginx-k8s-configuration')

    const {teardown, findAddress, namespace} = await setupKubernetes(nginxConfigurations, {
      forceRecreate: true,
    })

    const nginxAddress = await findAddress('nginx-service')
    await findAddress('postgres-service', {healthCheck: tcpHealthCheck})

    expect(await fetchAsText(`http://${nginxAddress}`)).to.include('Welcome to nginx')

    const serviceConfigCreationTime = JSON.parse(
      await shWithOutput(`kubectl get svc nginx-service --output=json --namespace=${namespace}`),
    ).metadata.creationTimestamp

    await teardown()

    const {
      teardown: teardown2,
      findAddress: findAddress2,
      namespace: namespace2,
    } = await setupKubernetes(nginxConfigurations)
    expect(namespace).to.eql(namespace2)

    const nginxAddress2 = await findAddress2('nginx-service')

    expect(nginxAddress2).to.equal(nginxAddress)

    expect(await fetchAsText(`http://${nginxAddress2}`)).to.include('Welcome to nginx')

    await teardown2()

    const serviceConfigCreationTime2 = JSON.parse(
      await shWithOutput(`kubectl get svc nginx-service --output=json --namespace=${namespace2}`),
    ).metadata.creationTimestamp

    expect(serviceConfigCreationTime2).to.equal(serviceConfigCreationTime)

    const {
      teardown: teardown3,
      findAddress: findAddress3,
      namespace: namespace3,
    } = await setupKubernetes(nginxConfigurations, {
      forceRecreate: true,
      namespaceCleanup: true,
    })

    const serviceConfigCreationTime3 = JSON.parse(
      await shWithOutput(`kubectl get svc nginx-service --output=json --namespace=${namespace3}`),
    ).metadata.creationTimestamp

    expect(serviceConfigCreationTime3).to.not.equal(serviceConfigCreationTime)

    const nginxAddress3 = await findAddress3('nginx-service')

    expect(await fetchAsText(`http://${nginxAddress3}`)).to.include('Welcome to nginx!')

    await teardown3()

    expect(await presult(fetchAsText(`http://${nginxAddress3}`))).to.containSubset([
      {code: 'ECONNREFUSED'},
    ])
  })

  it('should work with empty dirs and _not_ recurse', async () => {
    const nginxConfigurations = path.resolve(__dirname, 'fixtures/dir-with-no-yamls')

    const {teardown, findAddress} = await setupKubernetes(nginxConfigurations, {})

    const [err] = await presult(findAddress('nginx-service'))

    expect(err.message).to.include('services "nginx-service" not found')

    await teardown()
  })
})
