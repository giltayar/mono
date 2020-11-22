import yargs from 'yargs'

/**
 *
 * @param {string[]} argv
 * @param {{shouldExitOnError?: boolean}} options
 */
export async function app(argv, {shouldExitOnError = true} = {}) {
  const commandLineOptions = getCommandLineOptions(argv)

  const args = await commandLineOptions.exitProcess(shouldExitOnError).strict().help().parse()

  if (args._ && args._[0]) {
    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    ;(await import(`./commands/${args._[0]}.js`)).default(args)
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
      yargs.option('some-option', {
        describe: 'some-option description',
        type: 'string',
      }),
  )
}
