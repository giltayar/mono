import util from 'node:util'

export interface ConsoleCapturer {
  originals: {
    log: typeof console.log
    error: typeof console.error
  }
  logOutput: string[]
}

interface CaptureConsoleOptions {
  silent?: boolean
}

export function captureConsole({silent = true}: CaptureConsoleOptions = {}): ConsoleCapturer {
  const consoleCapturer: ConsoleCapturer = {
    originals: {log: console.log, error: console.error},
    logOutput: [],
  }

  const captureOutput =
    (stream: typeof process.stdout | typeof process.stderr) =>
    (format: unknown, ...args: unknown[]) => {
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

interface ConsoleOutputOptions {
  consoleCapturer: ConsoleCapturer
}

export function consoleOutputAsString({consoleCapturer}: ConsoleOutputOptions): string {
  const {logOutput} = consoleCapturer

  return logOutput.join('\n')
}

interface UncaptureConsoleOptions {
  consoleCapturer: ConsoleCapturer
}

export function uncaptureConsole({consoleCapturer}: UncaptureConsoleOptions): void {
  const {
    originals: {log: originalLog, error: originalError},
  } = consoleCapturer

  console.log = originalLog
  console.error = originalError
}

interface CaptureConsoleInTestOptions {
  silent?: boolean
}

interface CaptureConsoleInTestResult {
  consoleOutputAsString: (options?: {isLastTime?: boolean}) => string
  uncaptureConsole: () => void
}

export function captureConsoleInTest(
  before: (fn: () => void) => void,
  after: (fn: () => void) => void,
  {silent}: CaptureConsoleInTestOptions = {},
): CaptureConsoleInTestResult {
  let consoleCapturer: ConsoleCapturer

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
