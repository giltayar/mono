import split from 'split'

type JsonObject = Record<string, unknown>

const pinoTestkitGlobalSymbol = Symbol('pino-testkit-globals')

// Initialize the global array
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any)[pinoTestkitGlobalSymbol] = []

export function recordLogs(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any)[pinoTestkitGlobalSymbol] = []
}

export function playbackLogs(): JsonObject[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [...(globalThis as any)[pinoTestkitGlobalSymbol]]
}

export const loggerOptionsForRecorder = split((log: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any)[pinoTestkitGlobalSymbol].push(JSON.parse(log))

  console.log(log)
  return log + '\n'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any
