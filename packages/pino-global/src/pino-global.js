import {AsyncLocalStorage} from 'async_hooks'
import os from 'os'
import pino from 'pino'

/**
 * @typedef {{
 *  globalNamePrefix?: string | undefined
 *  globalLoggerOptions?: pino.LoggerOptions | undefined
 *  globalLoggerBaseBindings?: pino.Bindings | undefined
 *  errorInCaseOfMultipleInitializations?: Error | undefined
 *  allowMultipleInitializations: boolean
 * }} GlobalConfig
 */

/**
 * @type {GlobalConfig}
 */
globalThis.__pinoGlobalConfig = {
  allowMultipleInitializations: true,
}

/**
 *
 * @param {string} [namesPrefix]
 * @param {pino.Bindings} [baseBindings]
 * @param {pino.LoggerOptions} [loggerOptions]
 * @param {{allowMultipleInitializations?: boolean}} [options]
 */
export function initializeLoggerOptions(
  namesPrefix = undefined,
  baseBindings = undefined,
  loggerOptions = undefined,
  {allowMultipleInitializations = false} = {},
) {
  if (!globalThis.__pinoGlobalConfig.allowMultipleInitializations && allowMultipleInitializations) {
    throw new Error(
      `"allowMultipleInitializations" initialized to false once. Cannot overturn it to be true.`,
    )
  }
  if (
    !allowMultipleInitializations &&
    globalThis.__pinoGlobalConfig.errorInCaseOfMultipleInitializations
  ) {
    const previousStack = globalThis.__pinoGlobalConfig.errorInCaseOfMultipleInitializations?.stack

    throw new Error(
      `"initializeLoggerOptions" called twice. This is the call stack for the first time:
${previousStack}`,
    )
  }

  globalThis.__pinoGlobalConfig = {
    globalNamePrefix: namesPrefix,
    globalLoggerOptions: loggerOptions,
    globalLoggerBaseBindings: baseBindings,
    errorInCaseOfMultipleInitializations: !allowMultipleInitializations
      ? new Error('error for first call to "initializeLoggerOptions"')
      : undefined,
    allowMultipleInitializations,
  }
}

/**
 * @param {pino.LoggerOptions} loggerOptionsFromPinoTestkit
 */
export function initializeForTesting(loggerOptionsFromPinoTestkit) {
  return initializeLoggerOptions('test', undefined, loggerOptionsFromPinoTestkit, {
    allowMultipleInitializations: true,
  })
}

/**
 * @param {pino.Bindings} [baseBindings]
 *
 * @returns {pino.Logger}
 */
export function makeLogger(baseBindings = undefined) {
  const {globalNamePrefix, globalLoggerOptions, globalLoggerBaseBindings: globalLoggerBase} =
    cachedGlobalConfig ?? determineGlobalConfig()

  return /**@type{pino.Logger}*/ (makeLoggerThatCanRunWithChild(() =>
    pino({
      ...globalLoggerOptions,
      name: baseBindings?.name
        ? makeLoggerName(globalNamePrefix, baseBindings.name)
        : globalNamePrefix,
      base: {host: os.hostname, ...globalLoggerBase, ...baseBindings},
    }),
  ))
}

export default makeLogger

/**
 * @template T
 * @param {pino.Logger} logger
 * @param {() => T} f
 *
 */
export function runWithChildLogger(logger, f) {
  return asyncLocalStorage.run(logger, f)
}

/**
 * @param {pino.Logger} logger
 *
 */
export function enterWithChildLogger(logger) {
  return asyncLocalStorage.enterWith(logger)
}

/**
 *
 * @param {() => void} callback child logger will be exited only in the callback
 */
export function exitFromChildLogger(callback) {
  asyncLocalStorage.exit(callback)
}

const somePinoLogger = pino()

/**
 * @param {pino.Logger | (() => pino.Logger)} pinoLogger
 */
function makeLoggerThatCanRunWithChild(pinoLogger) {
  /**@type {WeakMap<pino.Logger, pino.Logger>} */
  const cache = new WeakMap()
  /**@type{pino.Logger|undefined} */
  let pinoLoggerCache = undefined

  /**
   * @returns {pino.Logger}
   */
  const finalPinoLogger = () => {
    // if (pinoLoggerCache) return pinoLoggerCache
    pinoLoggerCache = typeof pinoLogger === 'function' ? pinoLogger() : pinoLogger
    return pinoLoggerCache
  }

  const mirrorPinoLogger = typeof pinoLogger === 'function' ? somePinoLogger : pinoLogger

  return Object.assign(Object.create(Object.getPrototypeOf(mirrorPinoLogger)), mirrorPinoLogger, {
    debug: makeLoggingFunction('debug'),
    trace: makeLoggingFunction('trace'),
    info: makeLoggingFunction('info'),
    warn: makeLoggingFunction('warn'),
    error: makeLoggingFunction('error'),
    fatal: makeLoggingFunction('fatal'),
    /**
     * @param {pino.Bindings} bindings
     */
    child(bindings) {
      const foundLogger = findAsyncLogger(finalPinoLogger(), cache)
      const newBindings = {...foundLogger.bindings(), ...bindings}

      return makeLoggerThatCanRunWithChild(
        finalPinoLogger().child(
          bindings.name
            ? {
                ...newBindings,
                name: makeLoggerName(determineGlobalConfig().globalNamePrefix, bindings.name),
              }
            : newBindings,
        ),
      )
    },
  })

  /**
   * @param {pino.Level} level
   */
  function makeLoggingFunction(level) {
    return /** @param {any[]} args */ function (...args) {
      const foundLogger = findAsyncLogger(finalPinoLogger(), cache)

      //@ts-expect-error
      return foundLogger[level](...args)
    }
  }
}

/**
 * @param {pino.Logger} logger
 * @param {WeakMap<pino.Logger, pino.Logger>} [cache]
 */
function findAsyncLogger(logger, cache) {
  const threadChildLogger = /**@type{pino.Logger}*/ (asyncLocalStorage.getStore())
  /**@type{pino.Logger}*/
  let foundLogger

  if (threadChildLogger) {
    const cachedLogger = cache?.get(threadChildLogger)
    if (cachedLogger) {
      foundLogger = cachedLogger
    } else {
      const loggerBindings = logger.bindings()
      const newLogger = logger.child.call(threadChildLogger, loggerBindings)
      cache && cache.set(threadChildLogger, newLogger)

      foundLogger = newLogger
    }
  } else {
    foundLogger = logger
  }
  return foundLogger
}

/**
 * @returns {GlobalConfig}
 */
function determineGlobalConfig() {
  const envConfig = {
    globalNamePrefix: process.env.PINO_GLOBAL_NAME_PREFIX,
    globalLoggerBaseBindings: JSON.parse(process.env.PINO_GLOBAL_BASE_BINDINGS ?? '{}'),
    globalLoggerOptions: JSON.parse(process.env.PINO_GLOBAL_LOGGER_OPTIONS ?? '{}'),
  }

  const initGlobalOptions = globalThis.__pinoGlobalConfig

  /**@type {GlobalConfig} */
  const ret = {
    globalNamePrefix: makeName(envConfig.globalNamePrefix, initGlobalOptions.globalNamePrefix),
    globalLoggerOptions: {
      ...envConfig.globalLoggerOptions,
      ...initGlobalOptions.globalLoggerOptions,
    },
    globalLoggerBaseBindings: {
      ...envConfig.globalLoggerBaseBindings,
      ...initGlobalOptions.globalLoggerBaseBindings,
    },
    allowMultipleInitializations: initGlobalOptions.allowMultipleInitializations,
  }

  if (!initGlobalOptions.allowMultipleInitializations) {
    cachedGlobalConfig = ret
  }

  return ret

  /**
   * @param {string | undefined} envName
   * @param {string | undefined} globalThisName
   */
  function makeName(envName, globalThisName) {
    if (!envName && !globalThisName) {
      return undefined
    }

    if (!envName) {
      return globalThisName
    }

    if (!globalThisName) {
      return envName
    }

    return envName + globalThisName
  }
}

/**
 * @param {string | undefined} globalNamePrefix
 * @param {string} name
 */
function makeLoggerName(globalNamePrefix, name) {
  return globalNamePrefix ? globalNamePrefix + name : name
}

const asyncLocalStorage = new AsyncLocalStorage()

/**@type {GlobalConfig | undefined} */
let cachedGlobalConfig = undefined
