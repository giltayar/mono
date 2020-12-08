import {initializeLoggerOptions} from '../../../src/pino-global.js'

initializeLoggerOptions('hi')
initializeLoggerOptions(
  'oops. this is gonna throw!',
  undefined,
  {},
  {allowMultipleInitializations: true},
)
