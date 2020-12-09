import nodeFetch from 'node-fetch'
import {default as Agent, HttpsAgent} from 'agentkeepalive'
import merge from 'lodash.merge'
import {memo, makeError} from '@seasquared/functional-commons'
import {delay} from '@seasquared/promise-commons'

/**
 * @typedef {import('node-fetch').RequestInit & {requestId?: string}} RequestInitWithRequestId
 */

/**
 * @typedef {(url: string | URL, init?: RequestInitWithRequestId) =>
 *  Promise<import('node-fetch').Response>}
 * FetchFunction
 * */

/**
 *
 * @param {string | URL} url
 * @param {import('node-fetch').Response} response
 * @returns {Promise<void>}
 */
export async function throwErrorFromBadStatus(url, response) {
  const body = await response.text().catch(() => `failed to get body of error`)

  throw makeError(`Response ${response.status} returned from ${url}, body: ${body}`, {
    code: 'ERR_X_STATUS_CODE_NOT_OK',
    status: response.status,
    statusText: response.statusText,
    headers: response.headers.raw(),
    body: body,
  })
}

/**
 *
 * @param {string | URL} url
 * @param {RequestInitWithRequestId} [init]
 * @returns {Promise<Buffer>}
 */
export async function fetchAsBuffer(url, init) {
  const response = await fetch(url, init)

  if (!response.ok) await throwErrorFromBadStatus(url, response)

  return await response.buffer()
}

/**
 * @param {string | URL} url
 * @param {RequestInitWithRequestId} [init]
 * @returns {Promise<import('type-fest').JsonValue>}
 */
export async function fetchAsJson(url, init) {
  const response = await fetch(url, merge({headers: {Accept: 'application/json'}}, init))

  if (!response.ok) await throwErrorFromBadStatus(url, response)

  return await response.json()
}

/**
 * @param {string | URL} url
 * @param {RequestInitWithRequestId} [init]
 * @returns {Promise<string>}
 */
export async function fetchAsText(url, init) {
  const response = await fetch(url, init)

  if (!response.ok) await throwErrorFromBadStatus(url, response)

  return await response.text()
}

/**
 * @param {string | URL} url
 * @param {import('type-fest').JsonValue} json
 * @param {RequestInitWithRequestId} [init]
 * @returns {Promise<string>}
 */
export async function fetchAsTextWithJsonBody(url, json, init) {
  const response = await fetch(
    url,
    merge(
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(json)},
      init || {},
    ),
  )

  if (!response.ok) await throwErrorFromBadStatus(url, response)

  return await response.text()
}

/**
 * @param {string | URL} url
 * @param {import('type-fest').JsonValue} json
 * @param {RequestInitWithRequestId} [init]
 * @returns {Promise<Buffer>}
 */
export async function fetchAsBufferWithJsonBody(url, json, init) {
  const response = await fetch(
    url,
    merge(
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(json)},
      init || {},
    ),
  )

  if (!response.ok) await throwErrorFromBadStatus(url, response)

  return await response.buffer()
}

/**
 * @param {string | URL} url
 * @param {import('type-fest').JsonValue} json
 * @param {RequestInitWithRequestId} [init]
 * @returns {Promise<import('type-fest').JsonValue>}
 */
export async function fetchAsJsonWithJsonBody(url, json, init) {
  const response = await fetch(
    url,
    merge(
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify(json),
      },
      init || {},
    ),
  )

  if (!response.ok) await throwErrorFromBadStatus(url, response)

  return await response.json()
}
/**
 *
 * @param {string | URL} url
 * @param {RequestInitWithRequestId} [init]
 * @returns {Promise<import('node-fetch').Response>}
 */
export async function fetch(url, init) {
  return await nodeFetch(url, {
    //@ts-expect-error
    agent: defaultAgent(url?.protocol ?? new URL(url).protocol),
    ...(init?.requestId != null
      ? {
          ...init,
          headers: {
            'x-request-id': init.requestId,
            ...init.headers,
          },
        }
      : init),
  })
}

/**
 * @param {Function} f
 * @param {{retries?: number, sleepTime?: number, backoff?: number, idempotent?: boolean}} [options]
 */
export async function retryFetch(
  f,
  {retries = 2, sleepTime = 100, backoff = 1.1, idempotent = true} = {},
) {
  for (let retry = 0; retry <= retries; retry++) {
    if (retry === retries) {
      return await f(retry)
    }
    try {
      return await f(retry)
    } catch (err) {
      if (CONNECTION_ERROR_CODES.has(err.code) || CONNECTION_ERROR_CODES.has(err.type)) {
        // retry
      } else if (err.code === 'ERR_X_STATUS_CODE_NOT_OK') {
        if (err.status >= 300 && err.status < 500) {
          throw err
        }
      } else if (idempotent) {
        // retry
      } else {
        throw err
      }
      await delay(sleepTime * backoff ** retry)
    }
  }
}

const HTTP_FETCH_SOCKET_TIMEOUT = parseInt(
  process.env.HTTP_FETCH_SOCKET_TIMEOUT || `${5 * 60 * 1000}`,
  10,
)

const CONNECTION_ERROR_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ECONNRESET',
  'request-timeout',
])

const SOCKET_OPTIONS = {keepAlive: true, maxSockets: 512, timeout: HTTP_FETCH_SOCKET_TIMEOUT}
const defaultAgent = memo(
  /**@param {string} protocol*/ (protocol) =>
    protocol === 'http:' ? new Agent(SOCKET_OPTIONS) : new HttpsAgent(SOCKET_OPTIONS),
)
