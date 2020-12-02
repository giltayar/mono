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
      case 'generate':
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        await (await import(`./commands/generate.js`)).default(args)
        break
      case 'deploy':
        // eslint-disable-next-line node/no-unsupported-features/es-syntax
        await (await import(`./commands/deploy.js`)).default(args)
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
  return yargs(argv)
    .command('generate', 'generates the yaml files for deploying', (yargs) =>
      yargs
        .option('name', {
          describe: 'name of deployment',
          type: 'string',
          demandOption: true,
        })
        .option('cluster', {
          describe: 'cluster to deploy to',
          type: 'string',
        })
        .option('output', {
          alias: 'o',
          describe: 'directory where final yaml files will be written to',
          defaultDescription: 'current directory + "/dist"',
          type: 'string',
        })
        .option('input', {
          alias: 'i',
          describe: 'base directory',
          defaultDescription: 'current directory',
          type: 'string',
        })
        .option('package', {
          alias: 'p',
          describe: 'additional packages (and folders if starting with ".") besides cwd',
          type: 'string',
          array: true,
        })
        .option('values', {
          alias: 'v',
          describe: 'yaml file for values of chart (relative to input-directory)',
          type: 'string',
          array: true,
        })
        .option('override', {
          describe: 'set of key=value overrides',
          type: 'string',
          array: true,
        }),
    )
    .command('deploy', 'deploy the generated yaml files', (yargs) =>
      yargs
        .option('input', {
          alias: 'i',
          describe: 'directory to apply to kubernetes',
          defaultDescription: 'current directory + "/dist"',
          type: 'string',
        })
        .option('namespace', {
          alias: 'n',
          describe: 'namespace to deploy to',
          type: 'string',
          demandOption: true,
        })
        .option('message', {
          alias: 'm',
          describe: 'message to annotate deployment with',
          type: 'string',
        })
        .option('rollout-version', {
          alias: 'v',
          describe: 'deployment version',
          type: 'string',
          demandOption: true,
        })
        .option('dry-run', {
          alias: 'd',
          describe: 'dry run',
          type: 'boolean',
          default: false,
        })
        .option('docker-desktop', {
          describe: 'allow deploying to docker-desktop',
          type: 'boolean',
          default: false,
        }),
    )
}
