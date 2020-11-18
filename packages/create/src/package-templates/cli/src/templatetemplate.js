'use strict'
const yargs = require('yargs')

async function main(argv, {shouldExitOnError = false} = {}) {
  const commandLineOptions = yargs(argv)
    .command(
      'templatetemplate-command <something-something>',
      'something something description',
      (yargs) =>
        yargs.option('option-option', {
          describe: 'option-option description',
          type: 'string',
        }),
    )
    .exitProcess(shouldExitOnError)
    .strict()
    .help()

  const args = await commandLineOptions.parse()

  if (args._ && args._[0]) {
    await require(`./${args._[0]}`)(args)
  }
}

module.exports = main
