import {fetchAsJson, fetchAsJsonWithJsonBody} from '@giltayar/http-commons'

export interface RavmesserCredentials {
  clientId: string
  clientSecret: string
  userToken: string
}

export type RavmesserApiCaller = {
  credentials: RavmesserCredentials
  pendingAuth: Promise<{token: string; expiresAt: number}> | undefined
}

export function createRavmesserApiCaller(credentials: RavmesserCredentials): RavmesserApiCaller {
  return {credentials, pendingAuth: undefined}
}

export async function apiCall(
  api: RavmesserApiCaller,
  method: string,
  path: string,
  body?: object,
): Promise<unknown> {
  const url = new URL(path, API_URL)
  const headers = {Authorization: await authorizationHeader(api)}

  const response = (
    body === undefined
      ? await fetchAsJson(url, {method, headers})
      : await fetchAsJsonWithJsonBody(url, body as any, {method, headers})
  ) as {status?: boolean | number}

  // Failures are reported both as 4xx and as a 200 carrying `status: false`
  if (method !== 'GET' && !response.status) {
    throw new Error(`${method} ${path} failed in RavMesser: ${JSON.stringify(response)}`)
  }

  return response
}

async function authorizationHeader(api: RavmesserApiCaller): Promise<string> {
  api.pendingAuth ??= fetchToken(api)

  let auth = await api.pendingAuth

  if (Date.now() >= auth.expiresAt) {
    api.pendingAuth = fetchToken(api)
    auth = await api.pendingAuth
  }

  return `Bearer ${auth.token}`
}

async function fetchToken(api: RavmesserApiCaller): Promise<{token: string; expiresAt: number}> {
  try {
    const response = (await fetchAsJsonWithJsonBody(new URL('oauth/token', API_URL), {
      grant_type: 'client_credentials',
      client_id: api.credentials.clientId,
      client_secret: api.credentials.clientSecret,
      user_token: api.credentials.userToken,
    })) as {token: string; expire: number}

    // `expire` is a unix timestamp in seconds; renew a minute early
    return {token: response.token, expiresAt: response.expire * 1000 - 60_000}
  } catch (error) {
    api.pendingAuth = undefined
    throw error
  }
}

const API_URL = 'https://api.responder.live/'
