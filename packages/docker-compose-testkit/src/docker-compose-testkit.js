import path from 'path'
import crypto from 'crypto'
import net from 'net'
import {once} from 'events'
import {sh, shWithOutput} from '@giltayar/scripting-commons'
import {getDependencyInformation} from '@giltayar/dependencies-commons'
import retry from 'p-retry'
import {fetch} from '@giltayar/http-commons'
/**
 *
 * @param {string} dockerComposeFile
 * @param {{
 *  containerCleanup?: boolean,
 *  forceRecreate?: boolean,
 *  env?: Record<string, string | undefined>,
 *  variation?: string
 * }} options
 * @returns {Promise<{
 *  teardown: () => Promise<void>,
 *  findAddress: (
 *    serviceName: string,
 *    port?: number = 80,
 *    options?: {
 *      serviceIndex?: number,
 *      healthCheck?: (address: string) => Promise<void>}) => Promise<string>
 *  }>}
 */
export async function runDockerCompose(
  dockerComposeFile,
  {containerCleanup, forceRecreate, env, variation} = {},
) {
  const projectName = determineProjectName()
  const addresses = /**@type{Map<string, string>}*/ new Map()
  const envForDependencies = Object.fromEntries(
    Object.values(getDependencyInformation(dockerComposeFile)).map((x) => [x.envName, x.version]),
  )
  const finalEnv = env
    ? {...envForDependencies, ...env, PATH: process.env.PATH}
    : {...envForDependencies, PATH: process.env.PATH}

  await setup()

  return {
    teardown,
    findAddress,
  }

  async function setup() {
    await sh(
      `docker compose --file "${dockerComposeFile}" --project-name "${projectName}" up --detach ${
        forceRecreate ? '--force-recreate' : ''
      }`,
      {
        cwd: path.dirname(dockerComposeFile),
        env: finalEnv,
      },
    ).catch((err) => console.log(err))
  }

  async function teardown() {
    if (!containerCleanup) return
    await sh(
      `docker compose --file "${dockerComposeFile}" --project-name "${projectName}" down --volumes --remove-orphans`,
      {
        cwd: path.dirname(dockerComposeFile),
        env: finalEnv,
      },
    )
  }

  /**
   * @param {string} serviceName
   * @param {number} [port=80]
   * @param {{
   *  serviceIndex?: number,
   *  healthCheck?: (address: string) => Promise<void>,
   *  healthCheckTimeoutSec?: number
   * }} options
   */
  async function findAddress(
    serviceName,
    port = 80,
    {serviceIndex = 1, healthCheck = httpHealthCheck, healthCheckTimeoutSec = 60} = {},
  ) {
    const serviceKey = `${serviceName}:${port}:${serviceIndex}`
    if (addresses.has(serviceKey)) {
      return addresses.get(serviceKey)
    }
    const addressOutput = await shWithOutput(
      `docker compose --file "${dockerComposeFile}" --project-name "${projectName}" port  --index=${serviceIndex} ${serviceName} ${port}`,
      {
        cwd: path.dirname(dockerComposeFile),
        env: finalEnv,
      },
    )
    const address = addressOutput.trim()

    await waitUntilHealthy(address, healthCheck, healthCheckTimeoutSec)

    addresses.set(serviceKey, address)

    return address
  }

  function determineProjectName() {
    const hash = crypto
      .createHash('MD5')
      .update(dockerComposeFile + (env ? JSON.stringify(env) : '') + (variation ?? ''))
      .digest('base64')
      .toLowerCase()

    return `dct_${hash.replaceAll('=', '').replaceAll('/', '').replaceAll('+', '')}`
  }
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
    retries: 1000000,
  })
}

/**
 * @param {string} address
 */
export async function httpHealthCheck(address) {
  const response = await fetch(`http://${address}/`)

  await response.arrayBuffer()
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
