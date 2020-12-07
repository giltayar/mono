import {AsyncLocalStorage} from 'async_hooks'
import os from 'os'
import pino from 'pino'

/**
 * @typedef {{
 *  globalNamePrefix?: string | undefined;
 *  globalLoggerOptions?: pino.LoggerOptions | undefined;
 *  globalLoggerBase?: pino.Bindings | undefined;
 * }} GlobalConfig
 */

/**
 * @type {GlobalConfig}
 */
globalThis.__pinoGlobalConfig = {}

/**
 *
 * @param {string} [namesPrefix]
 * @param {pino.Bindings} [base]
 * @param {pino.LoggerOptions} [loggerOptions]
 */
export function initializeLoggerOptions(
  namesPrefix = undefined,
  base = undefined,
  loggerOptions = undefined,
) {
  globalThis.__pinoGlobalConfig = {
    globalNamePrefix: namesPrefix,
    globalLoggerOptions: loggerOptions,
    globalLoggerBase: base,
  }
}

/**
 * @param {string} name
 * @param {pino.Bindings} [base]
 *
 * @returns {pino.Logger}
 */
export function makeLogger(name, base = undefined) {
  const {globalNamePrefix, globalLoggerOptions, globalLoggerBase} =
    cachedGlobalConfig ?? determineGlobalConfig()

  return /**@type{pino.Logger}*/ (makeLoggerThatCanRunWithChild(
    pino({
      ...globalLoggerOptions,
      name: makeLoggerName(globalNamePrefix, name),
      base: {host: os.hostname, ...globalLoggerBase, ...base},
    }),
  ))
}

/**
 * @param {pino.Logger} pinoLogger
 */
function makeLoggerThatCanRunWithChild(pinoLogger) {
  /**@type {WeakMap<pino.Logger, pino.Logger>} */
  const cache = new WeakMap()

  return Object.assign(Object.create(Object.getPrototypeOf(pinoLogger)), pinoLogger, {
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
      const foundLogger = findAsyncLogger(pinoLogger, cache)
      const newBindings = {...foundLogger.bindings(), ...bindings}

      return makeLoggerThatCanRunWithChild(
        pinoLogger.child(
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
      const foundLogger = findAsyncLogger(pinoLogger, cache)

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
 * @template T
 * @param {pino.Logger} logger
 * @param {() => T} f
 *
 */
export function runWithChildLogger(logger, f) {
  // const foundLogger = findAsyncLogger(logger)
  // const bindings = foundLogger.bindings()

  return asyncLocalStorage.run(logger, f)
}

/**
 * @returns {GlobalConfig}
 */
function determineGlobalConfig() {
  const envConfig = process.env.GLOBAL_PINO_CONFIG ? JSON.parse(process.env.GLOBAL_PINO_CONFIG) : {}

  const initGlobalOptions = globalThis.__pinoGlobalConfig

  return {
    globalNamePrefix: makeName(envConfig.globalNamePrefix, initGlobalOptions.globalNamePrefix),
    globalLoggerOptions: {
      ...envConfig.globalLoggerOptions,
      ...initGlobalOptions.globalLoggerOptions,
    },
    globalLoggerBase: {...envConfig.globalLoggerBase, ...initGlobalOptions.globalLoggerBase},
  }

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
const cachedGlobalConfig = undefined
