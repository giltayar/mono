import yargs from 'yargs'

/**
 *
 * @param {string[]} argv
 * @param {{shouldExitOnError?: boolean}} options
 */
export async function app(argv, {shouldExitOnError = true} = {}) {
  const commandLineOptions = getCommandLineOptions(argv)

  const args = await commandLineOptions.exitProcess(shouldExitOnError).strict().help().parse()

  if (args._?.[0]) {
    switch (args._[0]) {
      case 'some-command':
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        ;(await import(`./commands/some-command.js`)).default(args)
        break
      default:
        commandLineOptions.showHelp()
        break
    }
  }
}

/**
 * @param {readonly string[]} argv
 */
function getCommandLineOptions(argv) {
  return yargs(argv).command(
    'some-command <some-parameter>',
    'something something description',
    (yargs) =>
      yargs
        .positional('some-parameter', {
          describe: 'some-parameter description',
          type: 'string',
          demandOption: true,
        })
        .option('some-option', {
          describe: 'some-option description',
          type: 'string',
        }),
  )
}
