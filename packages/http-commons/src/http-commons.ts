import Agent, {HttpsAgent} from 'agentkeepalive'
import merge from 'lodash.merge'
import {memo, makeError} from '@giltayar/functional-commons'
import {delay} from '@giltayar/promise-commons'
import type {JsonValue} from 'type-fest'

export type FetchFunction = (
  url: string | URL,
  init?: RequestInitWithRequestId,
) => Promise<Response>

// For some reason, eslint does not find the global `RequestInit` type, so I steal it from the fetch function
export type RequestInit = NonNullable<Parameters<typeof globalThis.fetch>[1]>
export type RequestInitWithRequestId = RequestInit & {requestId?: string}

export async function throwErrorFromBadStatus(
  url: string | URL,
  response: Response,
): Promise<void> {
  const body = await response.text().catch(() => `failed to get body of error`)

  throw makeError(`Response ${response.status} returned from ${url}, body: ${body}`, {
    code: 'ERR_X_STATUS_CODE_NOT_OK',
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(
      Array.from((response.headers as any).entries()) as Array<[string, string]>,
    ),
    body: body,
  })
}

export async function fetchAsBuffer(url: string | URL, init?: RequestInitWithRequestId) {
  const response = await fetch(url, init)

  if (!response.ok) await throwErrorFromBadStatus(url, response)

  return await response.arrayBuffer()
}

export async function fetchAsJson(url: string | URL, init?: RequestInitWithRequestId) {
  const response = await fetch(url, merge({headers: {Accept: 'application/json'}}, init))

  if (!response.ok) await throwErrorFromBadStatus(url, response)

  return await response.json()
}

export async function fetchAsText(url: string | URL, init?: RequestInitWithRequestId) {
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
export async function fetchAsTextWithJsonBody(
  url: string | URL,
  json: JsonValue,
  init?: RequestInitWithRequestId,
) {
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
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchAsBufferWithJsonBody(
  url: string | URL,
  json: JsonValue,
  init?: RequestInitWithRequestId,
) {
  const response = await fetch(
    url,
    merge(
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(json)},
      init || {},
    ),
  )

  if (!response.ok) await throwErrorFromBadStatus(url, response)

  return await response.arrayBuffer()
}

/**
 * @param {string | URL} url
 * @param {import('type-fest').JsonValue} json
 * @param {RequestInitWithRequestId} [init]
 * @returns {Promise<import('type-fest').JsonValue>}
 */
export async function fetchAsJsonWithJsonBody(
  url: string | URL,
  json: JsonValue,
  init?: RequestInitWithRequestId,
) {
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
 * @returns {Promise<Response>}
 */
export async function fetch(url: string | URL, init?: RequestInitWithRequestId) {
  return await globalThis
    .fetch(url, {
      //@ts-expect-error agent
      agent: defaultAgent((typeof url === 'string' ? new URL(url) : url).protocol),
      ...(init?.requestId != null
        ? {
            ...init,
            headers: {
              'x-request-id': init.requestId,
              ...(init.headers as Record<string, string>),
            },
          }
        : init),
    })
    .catch((err: any) =>
      (!err.status || !err.code) && err.cause ? Promise.reject(err.cause) : Promise.reject(err),
    )
}

/**
 * @param {Function} f
 * @param {{retries?: number, sleepTime?: number, backoff?: number, idempotent?: boolean}} options
 */
export async function retryFetch<T>(
  f: (retry: number) => Promise<T> | T,
  {
    retries = 2,
    sleepTime = 100,
    backoff = 1.1,
    idempotent = true,
  }: {
    retries?: number
    sleepTime?: number
    backoff?: number
    idempotent?: boolean
  } = {},
): Promise<T> {
  for (let retry = 0; retry <= retries; retry++) {
    if (retry === retries) {
      return await f(retry)
    }
    try {
      return await f(retry)
    } catch (err: any) {
      const code = err.code ?? err.cause?.code
      if (CONNECTION_ERROR_CODES.has(code) || CONNECTION_ERROR_CODES.has(err.type)) {
        // retry
      } else if (code === 'ERR_X_STATUS_CODE_NOT_OK') {
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
  // @ts-expect-error unreachable
  return undefined
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
  /**@param {string} protocol*/ (protocol: string) =>
    protocol === 'http:' ? new Agent(SOCKET_OPTIONS) : new HttpsAgent(SOCKET_OPTIONS),
)
