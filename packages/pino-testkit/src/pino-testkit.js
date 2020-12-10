export function recordLogs() {
  //@ts-expect-error
  globalThis[pinoTestkitGlobalSymbol] = []
}

/**
 * @returns {import('type-fest').JsonObject[]}
 */
export function playbackLogs() {
  //@ts-expect-error
  return globalThis[pinoTestkitGlobalSymbol]
}

export const loggerOptionsForRecorder = {
  prettifier: () => /** @param {import('type-fest').JsonObject} log */ (log) => {
    // @ts-expect-error
    globalThis[pinoTestkitGlobalSymbol].push(log)

    return JSON.stringify(log) + '\n'
  },
  prettyPrint: true,
}

const pinoTestkitGlobalSymbol = Symbol('pino-testkit-globals')

/**@type {import('type-fest').JsonObject[]} */
//@ts-expect-error
globalThis[pinoTestkitGlobalSymbol] = []
