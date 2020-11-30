import {makeLogger} from '../../../src/pino-global.js'

const logger = makeLogger('suffix', {a: 10, b: 11}, {messageKey: 'oooh'})

logger.info({c: 12}, 'lala')
logger.info({c: 13}, 'gaga')
