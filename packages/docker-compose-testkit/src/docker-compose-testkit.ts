import path from 'path'
import crypto from 'crypto'
import net from 'net'
import {once} from 'events'
import {getDependencyInformation} from '@giltayar/dependencies-commons'
import retry from 'p-retry'
import {$} from 'execa'
import {fetch} from '@giltayar/http-commons'

export type RunDockerComposeOptions = {
  containerCleanup?: boolean
  forceRecreate?: boolean
  env?: Record<string, string | undefined>
  variation?: string
}

export type FindAddressOptions = {
  serviceIndex?: number
  healthCheck?: (address: string) => Promise<void>
  healthCheckTimeoutSec?: number
}

export async function runDockerCompose(
  dockerComposeFile: string,
  {containerCleanup, forceRecreate, env, variation}: RunDockerComposeOptions = {},
) {
  const projectName = determineProjectName()
  const addresses = new Map<string, string>()
  const envForDependencies = Object.fromEntries(
    Object.values(await getDependencyInformation(dockerComposeFile)).map((x) => [
      x.envName,
      x.version,
    ]),
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
    await $({
      cwd: path.dirname(dockerComposeFile),
      env: finalEnv,
    })`docker compose --file ${dockerComposeFile} --project-name ${projectName} up --detach ${
      forceRecreate ? '--force-recreate' : '--force-recreate=0'
    }`
  }

  async function teardown() {
    if (!containerCleanup) return

    await $({
      cwd: path.dirname(dockerComposeFile),
      env: finalEnv,
    })`docker compose --file ${dockerComposeFile} --project-name ${projectName} down --volumes --remove-orphans`
  }

  async function findAddress(
    serviceName: string,
    port = 80,
    {
      serviceIndex = 1,
      healthCheck = httpHealthCheck,
      healthCheckTimeoutSec = 60,
    }: FindAddressOptions = {},
  ) {
    const serviceKey = `${serviceName}:${port}:${serviceIndex}`
    if (addresses.has(serviceKey)) {
      return addresses.get(serviceKey)!
    }
    const {stdout: addressOutput} = await $({
      cwd: path.dirname(dockerComposeFile),
      env: finalEnv,
    })`docker compose --file ${dockerComposeFile} --project-name ${projectName} port  --index=${serviceIndex} ${serviceName} ${port}`

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

async function waitUntilHealthy(
  address: string,
  healthCheck: (address: string) => Promise<void>,
  healthCheckTimeoutSec: number,
) {
  await retry(async () => await healthCheck(address), {
    maxRetryTime: healthCheckTimeoutSec * 1000,
    maxTimeout: 250,
    minTimeout: 250,
    retries: 1000000,
  })
}

export async function httpHealthCheck(address: string) {
  const response = await fetch(`http://${address}/`)

  await response.arrayBuffer()
}

export async function tcpHealthCheck(address: string) {
  const [host, port] = address.split(':')

  const socket = net.createConnection(parseInt(port, 10), host)

  await Promise.race([
    once(socket, 'connect'),
    once(socket, 'error').then(([err]) => Promise.reject(err)),
  ])

  socket.destroy()
}
