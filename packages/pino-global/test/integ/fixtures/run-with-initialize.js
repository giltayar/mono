import {initializeLoggerOptions, makeLogger} from '../../../src/pino-global.js'

if (process.argv[2]) {
  initializeLoggerOptions(...JSON.parse(process.argv[2]))
}

const logger = makeLogger('suffix')

logger.info({c: 3}, 'e1')
logger.info({c: 4}, 'e2')
