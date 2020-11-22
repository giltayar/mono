import util from 'util'

/**
 * @typedef {{
 *  originals: {
 *    log: any
 *    error: any
 *  }
 *  logOutput: string[]
 * }} ConsoleCapturer
 */

/**
 *
 * @param {{silent?: boolean}} options
 */
export function captureConsole({silent = true} = {}) {
  /**@type {ConsoleCapturer} */
  const consoleCapturer = {originals: {log: console.log, error: console.error}, logOutput: []}

  const captureOutput = /**@param {import('stream').Writable} stream */ (
    stream,
  ) => /**@param {any} format @param {any[]} args*/ (format, ...args) => {
    const output = util.format(format, ...args)

    consoleCapturer.logOutput.push(output)

    if (!silent) {
      stream.write(output)
      stream.write('\n')
    }
  }

  console.log = captureOutput(process.stdout)
  console.error = captureOutput(process.stderr)

  return consoleCapturer
}

/**
 *
 * @param {{consoleCapturer: ConsoleCapturer}} options
 */
export function consoleOutputAsString({consoleCapturer}) {
  const {logOutput} = consoleCapturer

  return logOutput.join('\n')
}

/**
 *
 * @param {{consoleCapturer: ConsoleCapturer}} options
 */
export function uncaptureConsole({consoleCapturer}) {
  const {
    originals: {log: originalLog, error: originalError},
  } = consoleCapturer

  console.log = originalLog
  console.error = originalError
}

/**
 *
 * @param {(f: () => void) => void} before
 * @param {(f: () => void) => void} after
 * @param {{silent?: boolean}} [options]
 */
export function captureConsoleInTest(before, after, {silent} = {}) {
  /**@type {ConsoleCapturer} */
  let consoleCapturer

  before(() => (consoleCapturer = captureConsole({silent})))

  after(() => uncaptureConsole({consoleCapturer}))

  return {
    consoleOutputAsString: ({isLastTime = true} = {}) => {
      const output = consoleOutputAsString({consoleCapturer})

      if (isLastTime) {
        uncaptureConsole({consoleCapturer})
      }

      return output
    },
    uncaptureConsole: () => uncaptureConsole({consoleCapturer}),
  }
}
