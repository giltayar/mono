import split from 'split'

export function recordLogs() {
  //@ts-expect-error
  globalThis[pinoTestkitGlobalSymbol] = []
}

/**
 * @returns {import('type-fest').JsonObject[]}
 */
export function playbackLogs() {
  //@ts-expect-error
  return [...globalThis[pinoTestkitGlobalSymbol]]
}

/** @type {any} */
export const loggerOptionsForRecorder = split(
  /** @param {import('type-fest').JsonObject} log */ (log) => {
    //@ts-expect-error
    globalThis[pinoTestkitGlobalSymbol].push(JSON.parse(log))

    console.log(log)
    return log + '\n'
  },
)

const pinoTestkitGlobalSymbol = Symbol('pino-testkit-globals')

/**@type {import('type-fest').JsonObject[]} */
//@ts-expect-error
globalThis[pinoTestkitGlobalSymbol] = []
