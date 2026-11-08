import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {Resolver} from 'node:dns/promises'
import https from 'node:https'
import type {LookupFunction} from 'node:net'
import {setTimeout as delay} from 'node:timers/promises'

export type CloudflaredTunnel = {
  publicUrl: string
  // Resolves once `url` (under `publicUrl`) answers a POST with `expectedStatus`.
  waitUntilReachable: (url: string, expectedStatus: number) => Promise<void>
  close: () => Promise<void>
}

// Exposes a local port on a public `*.trycloudflare.com` URL (a quick tunnel; no account needed).
export async function openCloudflaredTunnel({port}: {port: number}): Promise<CloudflaredTunnel> {
  const tunnel = spawn(
    'cloudflared',
    ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`],
    {stdio: ['ignore', 'pipe', 'pipe']},
  )
  const tunnelExited = once(tunnel, 'exit')

  async function close() {
    if (tunnel.exitCode === null && tunnel.signalCode === null) {
      tunnel.kill('SIGTERM')
      await tunnelExited
    }
  }

  try {
    return {publicUrl: await tunnelUrl(tunnel), waitUntilReachable, close}
  } catch (error) {
    await close()
    throw error
  }
}

function tunnelUrl(tunnel: ReturnType<typeof spawn>): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(
      () => reject(new Error(`cloudflared did not report a tunnel URL:\n${output}`)),
      60_000,
    )
    const onData = (chunk: Buffer) => {
      output += chunk
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
      if (match) {
        clearTimeout(timeout)
        resolve(match[0])
      }
    }
    tunnel.stdout?.on('data', onData)
    tunnel.stderr?.on('data', onData)
    tunnel.once('error', (error) => {
      clearTimeout(timeout)
      reject(
        (error as Error & {code?: string}).code === 'ENOENT'
          ? new Error('cloudflared is not installed. Install it with `brew install cloudflared`.')
          : error,
      )
    })
    tunnel.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`cloudflared exited with code ${code}:\n${output}`))
    })
  })
}

// The local resolver caches the tunnel hostname's NXDOMAIN if queried too early, so readiness is
// checked through Cloudflare's public DNS, which is what remote callers effectively see.
const resolver = new Resolver()
resolver.setServers(['1.1.1.1', '1.0.0.1'])
const publicLookup: LookupFunction = (hostname, options, callback) => {
  resolver.resolve4(hostname).then(
    (addresses) =>
      options.all
        ? callback(
            null,
            addresses.map((address) => ({address, family: 4})),
          )
        : callback(null, addresses[0], 4),
    (error: Error & {code?: string}) => callback(error, '', 4),
  )
}

// Uses `https.request` rather than `fetch` because only it accepts a custom `lookup`, needed for
// `publicLookup`. `fetch` would need an undici Agent (an extra dependency), and requesting by IP
// breaks TLS hostname verification.
async function waitUntilReachable(url: string, expectedStatus: number): Promise<void> {
  const deadline = Date.now() + 90_000
  let last = ''
  while (Date.now() < deadline) {
    last = await new Promise<string>((resolve) => {
      const request = https.request(
        url,
        {method: 'POST', lookup: publicLookup, headers: {'content-type': 'application/json'}},
        (response) => {
          response.resume()
          resolve(String(response.statusCode))
        },
      )
      request.on('error', (error: Error & {code?: string}) => resolve(error.code ?? error.message))
      request.end('{}')
    })
    if (last === String(expectedStatus)) return
    await delay(1000)
  }
  throw new Error(`${url} did not become reachable through the tunnel (last result: ${last})`)
}
