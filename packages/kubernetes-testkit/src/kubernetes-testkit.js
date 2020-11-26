import {memoAsync} from '@seasquared/functional-commons'
import {fetch} from '@seasquared/http-commons'
import {presult, unwrapPresult} from '@seasquared/promise-commons'
import {exec, execFile, spawn} from 'child_process'
import crypto from 'crypto'
import {once} from 'events'
import net from 'net'
import retry from 'p-retry'
import pino from 'pino'
import {promisify} from 'util'

const logger = pino()

/**
 *
 * @param {{
 *  namespace?: string,
 *  envCleanup?: boolean
 * }} [options]
 */
export async function setupKubernetes({
  namespace = generateRandomYetStableNamespace(),
  envCleanup = false,
} = {}) {
  if (!isDockerDesktop(await determineClusterType())) {
    logger.info('switching to Desktop Docker Kubernetes')

    await kubectlSpawn(undefined, 'config', 'use-context', 'docker-desktop')

    if (!isDockerDesktop(await determineClusterType()))
      throw new Error(`Failed to change kubectl context to 'docker-desktop'`)
  }

  await createNamespaceWithLabeIfNeeded(namespace, 'deployed-with-kubernetes-testkit')

  const [clusterIp] = await Promise.all([
    determineClusterIp(),
    setupDockerRegistrySecretForImagePull(namespace),
  ])

  return {
    namespace,
    teardown,
    /**
     * @param {string} name
     * @param {{
     *  portIndex?: number | undefined,
     *  healthCheck?: (address) => Promise<void>
     *  healthCheckTimeoutSec?: number | undefined
     * }} options
     */
    async findAddress(name, {portIndex, healthCheck, healthCheckTimeoutSec = 120}) {
      return findAddressAndHealthCheck(namespace, clusterIp, name, {
        portIndex,
        healthCheck,
        healthCheckTimeoutSec,
      })
    },
  }

  async function teardown() {
    if (!envCleanup) return
    await deleteNamespace(namespace)
  }
}

function generateRandomYetStableNamespace() {
  const hash = crypto.createHash('MD5').update(process.cwd()).digest('base64')

  return `kt_${hash.replace('==', '').replace('=', '')}`
}

async function determineClusterType() {
  const currentContext = (await kubectlExec(undefined, 'config', 'current-context')).stdout.trim()
  console.log(currentContext)

  return isDockerDesktop(currentContext) ? currentContext : 'other'
}

async function determineClusterIp() {
  const config = JSON.parse(
    (await kubectlExec(undefined, 'config', 'view', '--output=json')).stdout,
  )

  const currentContextName = config['current-context']
  const currentContext = config.contexts.find(
    /** @param {any} c */ (c) => c.name === currentContextName,
  ).context

  const currentClusterName = currentContext.cluster
  const currentCluster = config.clusters.find(
    /** @param {any} c */ (c) => c.name === currentClusterName,
  ).cluster

  return new URL(currentCluster.server).hostname
}

/**
 * @param {string} namespace
 * @param {string} label
 */
async function createNamespaceWithLabeIfNeeded(namespace, label) {
  let skipLabeling = false

  try {
    await kubectlExec(undefined, 'create', 'namespace', namespace)
  } catch (err) {
    if (!err.message.includes('already exists')) throw err
    skipLabeling = true
  }

  if (!skipLabeling) {
    await kubectlSpawn(undefined, 'label', 'namespace', namespace, label)
  }
}

/**
 * @param {string} namespace
 * @param {boolean} [waitForIt]
 */
async function deleteNamespace(namespace, waitForIt = false) {
  const result = presult(kubectlExec(undefined, 'delete', 'namespace', namespace))

  if (waitForIt) {
    await unwrapPresult(result)
  }
}

/**
 * @param {string} context
 */
function isDockerDesktop(context) {
  return context === 'docker-desktop' || context === 'docker-for-desktop'
}

/**
 * @param {string|undefined} namespace
 * @param {string[]} args
 */
async function kubectlExec(namespace, ...args) {
  logger.info('executing kube command %d', args, {namespace})

  return await promisify(execFile)('kubectl', [
    ...(namespace ? ['--namespace', namespace] : []),
    ...args,
  ])
}

/**
 * @param {string|undefined} namespace
 * @param {string[]} args
 */
async function kubectlSpawn(namespace, ...args) {
  logger.info('executing kube command %d', args, {namespace})

  await new Promise((resolve, reject) => {
    spawn('kubectl', [...(namespace ? ['--namespace', namespace] : []), ...args], {
      shell: false,
      stdio: 'inherit',
    }).on('exit', (code) =>
      code !== 0
        ? reject(new Error(`Spawn ${args.join(' ')} failed with error code ${code}`))
        : resolve(0),
    )
  })
}

/**
 * @param {string} namespace
 */
async function setupDockerRegistrySecretForImagePull(namespace) {
  const {registryAddress, username, password} = await getDockerRegistryInfo()
  if (!registryAddress) {
    throw new Error(`couldn't find Docker authentication information`)
  }

  const secretKey = 'k8s-testkit-regsecret'
  await kubectlSpawn(
    namespace,
    'create',
    'secret',
    'docker-registry',
    secretKey,
    `--docker-server=${registryAddress}`,
    `--docker-username=${username}`,
    `--docker-password=${password}`,
    `--docker-email=zubi@dubi.com`,
  )

  await kubectlSpawn(
    namespace,
    'patch',
    'serviceaccount',
    'default',
    '-p',
    `{"imagePullSecrets": [{"name": "${secretKey}"}]}`,
  )
}

async function getDockerRegistryInfo() {
  const computedRegistryAddress = 'index.docker.io'

  const {stdout: stdoutCredentialsGetCommand} = await promisify(exec)(
    `echo "${computedRegistryAddress}" | docker-credential-desktop get`,
  )

  const credentials = JSON.parse(stdoutCredentialsGetCommand)

  return {
    registryAddress: computedRegistryAddress,
    username: credentials.Username,
    password: credentials.Secret,
  }
}

const findAddressAndHealthCheck = memoAsync(
  async (namespace, clusterIp, name, {portIndex = 0, healthCheck, healthCheckTimeoutSec}) => {
    const address = await findServiceAddressInNamespace(
      namespace,
      clusterIp,
      name,
      portIndex,
      healthCheck,
      healthCheckTimeoutSec,
    )

    if (!healthCheck) return address

    return address
  },
)

/**
 * @param {string} namespace
 * @param {string} clusterIp
 * @param {string} name
 * @param {number} exposedPortIndex
 * @param {((address: string) => Promise<void>) | undefined} healthCheck
 * @param {number} healthCheckTimeoutSec
 */
async function findServiceAddressInNamespace(
  namespace,
  clusterIp,
  name,
  exposedPortIndex,
  healthCheck,
  healthCheckTimeoutSec,
) {
  const serviceConfigString = (await kubectlExec(namespace, 'get', 'svc', name, '--output=json'))
    .stdout

  const serviceConfig = JSON.parse(serviceConfigString)

  const serviceType = serviceConfig.spec.type
  if (serviceType === 'ClusterIP')
    throw new Error(
      `Service type is 'ClusterIP', which means you created it as a service, and not app. You cannot get address of such`,
    )

  const port = serviceConfig.spec.ports[exposedPortIndex].nodePort
  const address = `${clusterIp}:${port}`

  if (healthCheck) {
    await waitUntilHealthy(address, healthCheck, healthCheckTimeoutSec)
  }

  return address
}

/**
 * @param {string} address
 * @param {(address: string) => Promise<void>} healthCheck
 * @param {number} healthCheckTimeoutSec
 */
async function waitUntilHealthy(address, healthCheck, healthCheckTimeoutSec) {
  await retry(async () => await healthCheck(address), {
    maxRetryTime: healthCheckTimeoutSec * 1000,
    maxTimeout: 250,
    minTimeout: 250,
  })
}


/**
 * @param {string} address
 */
export async function httpHealthCheck(address) {
  const response = await fetch(`http://${address}/`)

  await response.buffer()
}

/**
 * @param {string} address
 */
export async function tcpHealthCheck(address) {
  const [host, port] = address.split(':')

  const socket = net.createConnection(parseInt(port, 10), host)

  await Promise.race([
    once(socket, 'connect'),
    once(socket, 'error').then(([err]) => Promise.reject(err)),
  ])

  socket.destroy()
}
