import {memoAsync} from '@seasquared/functional-commons'
import {fetch} from '@seasquared/http-commons'
import {delay} from '@seasquared/promise-commons'
import {exec, execFile, spawn} from 'child_process'
import crypto from 'crypto'
import {once} from 'events'
import net from 'net'
import retry from 'p-retry'
import path from 'path'
import pino from 'pino'
import {promisify} from 'util'

const logger = pino()

/**
 * @param {string} [dirOrFileToApplyToKubernetes]
 * @param {{
 *  namespaceCleanup?: boolean
 *  forceRecreate?: boolean
 * }} [options]
 */
export async function setupKubernetes(
  dirOrFileToApplyToKubernetes,
  {namespaceCleanup = false, forceRecreate = false} = {},
) {
  const namespace = generateRandomYetStableNamespace(
    dirOrFileToApplyToKubernetes
      ? path.resolve(dirOrFileToApplyToKubernetes, process.cwd())
      : process.cwd(),
  )

  if (!isDockerDesktop(await determineClusterType())) {
    logger.info('switching to Desktop Docker Kubernetes')

    await kubectlSpawn(undefined, 'config', 'use-context', 'docker-desktop')

    if (!isDockerDesktop(await determineClusterType()))
      throw new Error(`Failed to change kubectl context to 'docker-desktop'`)
  }

  if (forceRecreate) {
    logger.info('deleting namespace', namespace, 'to recreate it')

    await deleteNamespace(namespace, true)

    await delay(30000)
  }

  const alreadyCreated = await createNamespaceWithLabeIfNeeded(
    namespace,
    'deployed-with-kubernetes-testkit',
  )

  const [clusterIp] = await Promise.all([
    determineClusterIp(),
    alreadyCreated ? Promise.resolve() : setupDockerRegistrySecretForImagePull(namespace),
  ])

  if (dirOrFileToApplyToKubernetes) {
    await applyToKubernetes(dirOrFileToApplyToKubernetes)
  }

  const findAddressAndHealthCheck = memoAsync(
    async (clusterIp, name, {portIndex = 0, healthCheck, healthCheckTimeoutSec}) => {
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

  return {
    namespace,
    teardown,
    /**
     * @param {string} name
     * @param {{
     *  portIndex?: number | undefined,
     *  healthCheck?: (address: string) => Promise<void>
     *  healthCheckTimeoutSec?: number | undefined
     * }} [options]
     */
    async findAddress(
      name,
      {portIndex = 0, healthCheck = httpHealthCheck, healthCheckTimeoutSec = 120} = {},
    ) {
      return findAddressAndHealthCheck(clusterIp, name, {
        portIndex,
        healthCheck,
        healthCheckTimeoutSec,
      })
    },
    applyToKubernetes,
  }

  /**
   * @param {string} dirOrFile
   */
  async function applyToKubernetes(dirOrFile) {
    return await applyToKubernetesNamespace(namespace, dirOrFile)
  }

  async function teardown() {
    if (!namespaceCleanup) return

    await deleteNamespace(namespace)
  }
}

/**
 * @param {string} dirname
 */
function generateRandomYetStableNamespace(dirname) {
  const hash = crypto.createHash('MD5').update(dirname).digest('base64')

  return `kt-${hash.replace('==', '').replace('=', '').toLowerCase()}`
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
  try {
    await kubectlExec(undefined, 'create', 'namespace', namespace)
    await kubectlSpawn(undefined, 'label', 'namespace', namespace, `${label}=true`)

    return false
  } catch (err) {
    if (!err.message.includes('already exists')) throw err

    return true
  }
}

/**
 * @param {string} namespace
 * @param {boolean} [waitForIt]
 */
async function deleteNamespace(namespace, waitForIt = false) {
  try {
    await kubectlExec(
      undefined,
      'delete',
      'namespace',
      namespace,
      '--grace-period=1',
      `--wait=${waitForIt ? 'true' : 'true'}`,
    )
  } catch (err) {
    if (err.message.includes('not found')) {
      return
    }
    throw err
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
  logger.info('executing kube command %o', args, {namespace})

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
  logger.info('executing kube command %o', args, {namespace})

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
      `
Service type is 'ClusterIP', which means you created it as a service, and not app. You cannot get address of such.
Specify {spec: {type: 'NodePort'}} in service yaml`,
    )

  const port = serviceConfig.spec.ports[exposedPortIndex].nodePort
  const address = `${clusterIp}:${port}`

  if (healthCheck) {
    await waitUntilHealthy(address, healthCheck, healthCheckTimeoutSec)
  }

  return address
}
/**
 * @param {string} namespace
 * @param {string} dirOrFile
 */
async function applyToKubernetesNamespace(namespace, dirOrFile) {
  logger.info('applying', dirOrFile, 'to namespace', namespace)

  // Check for the situation that there are no files
  // @ts-expect-error
  const {noFiles} = await kubectlExec(
    namespace,
    'apply',
    '--wait=true',
    '--recursive=false',
    '--record=true',
    '--dry-run',
    '-f',
    dirOrFile,
  ).catch((err) => {
    if (err.stderr.includes('recognized file extensions are')) {
      return {noFiles: true}
    }
  })
  if (noFiles) {
    return
  }

  await kubectlSpawn(
    namespace,
    'apply',
    '--wait=true',
    '--recursive=true',
    '--record=true',
    '-f',
    dirOrFile,
  )
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
