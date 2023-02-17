import path from 'path'
import mergeOptions from 'merge-options'
import {remote} from 'webdriverio'
import retry from 'p-retry'
import {sh, shWithOutput} from '@seasquared/scripting-commons'
import {ptimeoutWithValue} from '@seasquared/promise-commons'
import {runDockerCompose} from '@seasquared/docker-compose-testkit'
import 'chromedriver'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

const isLinux = (await shWithOutput('uname -s')).trim() === 'Linux'

/**
 * @param {string} [baseUrl]
 * @param {WebdriverIO.ServiceOption & {browser?: string, callerFilename?: string}} [options]
 * @returns {Promise<{browser: import('webdriverio').Browser, teardown: () => Promise<void>}>}
 */
export async function automateBrowserWithWebdriverIO(baseUrl, options) {
  const useDockerBrowser = !options?.browser
  const {findAddress, teardown: teardownDocker} = useDockerBrowser
    ? await runDockerCompose(path.join(__dirname, 'docker-compose.yaml'), {
        forceRecreate: !!process.env.FULL_TEST,
        containerCleanup: !!process.env.FULL_TEST,
        variation: __filename + (options?.callerFilename ?? baseUrl),
        env: {
          IMAGE:
            // temporary solution till the formal selenium images have an arm arch too
            // till then, we have to use the alternative image, as the selenium formal
            // ones don't work in quemu under arm.
            process.arch === 'arm64'
              ? 'henningn/selenium-standalone-firefox:4.1.2-20220217'
              : 'selenium/standalone-firefox:4.0.0',
          HOST_DOCKER_INTERNAL: isLinux ? 'host.docker.internal:host-gateway' : 'asdfjksdgfjhgfsadfsdfa:sadkfhsjdf'
        },
      })
    : {findAddress: undefined, teardown: undefined}

  const [host, port] = findAddress ? (await findAddress('firefox', 4444)).split(':') : ['', '']

  const defaultOptions = {
    automationProtocol: 'webdriver',
    baseUrl: useDockerBrowser && baseUrl ? adjustUrlForDocker(baseUrl) : baseUrl,
    ...(host && port ? {hostname: host, port: parseInt(port)} : {}),
    capabilities: {browserName: options?.browser ?? 'firefox'},
    logLevel: 'error',
    connectionRetryTimeout: 5000,
    hostname: '127.0.0.1',
  }

  const finalOptions = options ? mergeOptions(defaultOptions, options) : defaultOptions

  if (!useDockerBrowser) {
    const browser = options?.browser
    if (browser === 'chrome') {
      await sh('pkill chromedriver').catch((_) => 1)
      await (await import('chromedriver')).default.start(['--port=4444'])
    } else if (browser === 'firefox') {
      await sh('pkill geckodriver').catch((_) => 1)
      ;(await import('geckodriver')).default.start()
      await new Promise((resolve) => setTimeout(resolve, 3000))
    } else {
      throw new Error(`cannot load selenium driver for unknown driver ${browser}`)
    }
  }

  const browser = await retry(() => remote(finalOptions), {
    minTimeout: 100,
    maxTimeout: 100,
    retries: 10,
  })

  return {teardown, browser}

  async function teardown() {
    await ptimeoutWithValue(browser.deleteSession(), 5000, 'timedout')

    await teardownDocker?.()

    if (options?.browser === 'firefox') {
      ;(await import('geckodriver')).default.stop()
    } else if (options?.browser === 'chrome') {
      ;(await import('chromedriver')).default.stop()
    }
  }
}

/**
 *  platforms that use docker desktop are running the docker containers in a vm, so
 *  to access the host's "localhost" we need to use docker's dummy host
 *  `host.docker.internal`, which points to the host's localhost. This functions
 *  replaces the url's hostname if needed
 *
 * @param {string} url
 */
export function adjustUrlForDocker(url) {
  const urlUrl = new URL(url)
  if (HOSTS_THAT_NEED_REPLACING.has(urlUrl.hostname)) {
    urlUrl.hostname = 'host.docker.internal'
  }

  return urlUrl.href
}



const HOSTS_THAT_NEED_REPLACING = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

/**
 * @param {import('webdriverio').Browser} browser
 * @param {string} selector
 * @returns {Promise<string>}
 */
export async function getTextForSelector(browser, selector) {
  return await (await browser.$(selector)).getText()
}

/**
 * @param {import('webdriverio').Browser} browser
 * @param {string} path
 * @param {{timeout?:number; pause?: number}} options
 */
export async function openUrlAndAwaitPageLoad(browser, path, {timeout = 5000, pause = 1000} = {}) {
  await browser.url(path)
  await browser.waitUntil(
    async () => {
      const state = await browser.execute(function () {
        return document.readyState
      })
      return state === 'complete'
    },
    {timeout},
  )
  await browser.pause(pause)
}
