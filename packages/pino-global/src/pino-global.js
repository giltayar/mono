import os from 'os'
import pino from 'pino'

/**
 * @type {import('pino').LoggerOptions| undefined}
 */
globalThis.__pinoGlobalLoggerOptions = undefined
/**
 * @type {Record<string, any> | undefined}
 */
globalThis.__pinoGlobalLoggerBase = undefined
/**
 * @type {string | undefined}
 */
globalThis.__pinoGlobalBaseName = undefined

/**
 *
 * @param {string} [namesPrefix]
 * @param {Record<string, any>} [base]
 * @param {import('pino').LoggerOptions} [loggerOptions]
 */
export function initializeLoggerOptions(
  namesPrefix = undefined,
  base = undefined,
  loggerOptions = undefined,
) {
  globalThis.__pinoGlobalBaseName = namesPrefix
  globalThis.__pinoGlobalLoggerOptions = loggerOptions
  globalThis.__pinoGlobalLoggerBase = base
}

/**
 * @param {string} name
 * @param {Record<string, any>} [base]
 * @param {import('pino').LoggerOptions} [loggerOptions]
 *
 * @returns {import('pino').Logger}
 */
export function makeLogger(name, base = undefined, loggerOptions = undefined) {
  const {globalNamePrefix, globalLoggerOptions, globalLoggerBase} = determineGlobalConfig()
  return pino({
    ...globalLoggerOptions,
    ...loggerOptions,
    name: globalNamePrefix ? globalNamePrefix + name : name,
    base: {host: os.hostname, ...globalLoggerBase, ...base},
  })
}

/**
 * @returns {{
 *  globalNamePrefix: string | undefined,
 *  globalLoggerOptions: import('pino').LoggerOptions | undefined,
 *  globalLoggerBase: Record<string, any> | undefined
 * }}
 */
function determineGlobalConfig() {
  const envConfig = process.env.GLOBAL_PINO_CONFIG ? JSON.parse(process.env.GLOBAL_PINO_CONFIG) : {}

  return {
    globalNamePrefix: makeName(envConfig.globalNamePrefix, globalThis.__pinoGlobalBaseName),
    globalLoggerOptions: {
      ...envConfig.globalLoggerOptions,
      ...globalThis.__pinoGlobalLoggerOptions,
    },
    globalLoggerBase: {...envConfig.globalLoggerBase, ...globalThis.__pinoGlobalLoggerBase},
  }
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
