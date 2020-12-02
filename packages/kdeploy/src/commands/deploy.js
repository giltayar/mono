import {sh, shWithOutput} from '@seasquared/scripting-commons'
import inquirer from 'inquirer'
import path from 'path'

/**
 *
 * @param {{
 *  input?: string
 *  namespace: string
 *  message?: string,
 *  'rollout-version': string,
 *  'dry-run'?: boolean
 *  'docker-desktop': boolean
 * }} param0
 */
export default async function deploy({
  input: inputDirectory = path.resolve(process.cwd(), 'dist'),
  namespace,
  message,
  'rollout-version': version,
  'docker-desktop': dockerDesktop,
  'dry-run': dryRun,
}) {
  await ensureDockerDesktopCompatibility(dockerDesktop)
  message = await promptForMessageIfNeeded(message)

  const deployments = !dryRun ? await listDeployments(namespace, inputDirectory) : []

  const deploymentGenerations = await Promise.all(
    deployments.map((d) => getDeploymentGeneration(namespace, d)),
  )

  await sh([
    'kubectl',
    'apply',
    '--namespace',
    namespace,
    '-f',
    inputDirectory,
    ...(dryRun ? ['--dry-run'] : []),
  ])

  if (!dryRun) {
    const newDeploymentGenerations = await Promise.all(
      deployments.map((d) => getDeploymentGeneration(namespace, d)),
    )

    await Promise.all(
      deployments
        .filter((_, i) => deploymentGenerations[i] !== newDeploymentGenerations[i])
        .map((deployment) =>
          sh([
            'kubectl',
            '--namespace',
            namespace,
            'annotate',
            'deploy',
            deployment,
            `kubernetes.io/change-cause="${version}: ${message}"`,
          ]),
        ),
    )

    await Promise.all(
      deployments
        .filter((_, i) => deploymentGenerations[i] !== newDeploymentGenerations[i])
        .map((deployment) =>
          sh(['kubectl', '--namespace', namespace, 'rollout', 'status', 'deployment', deployment]),
        ),
    )
  }
}

/**
 * @param {string} namespace
 * @param {string} inputDirectory
 *
 * @returns {Promise<string[]>}
 */
async function listDeployments(namespace, inputDirectory) {
  const output = await shWithOutput([
    'kubectl',
    'apply',
    '--namespace',
    namespace,
    '-f',
    inputDirectory,
    '--dry-run=client',
    '--output=json',
  ])

  const deployments = /**@type {{items: any[]}} */ (JSON.parse(output)).items
    .filter((item) => item.kind === 'Deployment')
    .map((item) => item.metadata.name)

  return deployments
}

/**
 * @param {string} namespace
 * @param {string} d
 *
 * @returns {Promise<number|undefined>}
 */
async function getDeploymentGeneration(namespace, d) {
  const output = await shWithOutput([
    'kubectl',
    '--namespace',
    namespace,
    'get',
    'deploy',
    d,
    '--output=json',
  ]).catch((err) => (err.message.includes('not found') ? Promise.resolve() : Promise.reject(err)))

  return output ? JSON.parse(output).metadata.generation : undefined
}

/**
 * @param {string | undefined} message
 */
async function promptForMessageIfNeeded(message) {
  if (!message) {
    ;({message} = await inquirer.prompt([
      {
        name: 'message',
        type: 'string',
        validate: (message) => (message ? true : 'message must not be empty'),
      },
    ]))
  }

  return message
}

/**
 * @param {boolean} dockerDesktop
 */
async function ensureDockerDesktopCompatibility(dockerDesktop) {
  const currentContext = (await shWithOutput('kubectl config current-context')).trim()
  if (
    (currentContext !== 'docker-desktop' && dockerDesktop) ||
    (currentContext === 'docker-desktop' && !dockerDesktop)
  ) {
    throw new Error(
      `if you wish to deploy to docker-desktop, add "--docker-desktop", otherwise don't`,
    )
  }
}
