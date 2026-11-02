import {realpathSync} from 'node:fs'
import {basename, relative, resolve} from 'node:path'
import type {ExecutorContext} from 'nx/src/config/misc-interfaces'
import {
  applyNextVersion,
  fetchPublishedVersions,
  readManifest,
  selectVersion,
} from './next-package-version.ts'
import {changesSinceRelease, describeChanges, isUnchanged, releaseTag} from './package-changes.ts'
import {runCommand, type CommandRunner} from './run-command.ts'

export type PublishOptions = {message?: string; dryRun?: boolean}

const coauthor = 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'

export async function publishExecutor(
  options: PublishOptions,
  context: ExecutorContext,
  runner: CommandRunner = runCommand,
): Promise<{success: boolean}> {
  const dryRun = options.dryRun === true
  if (
    (!dryRun || options.message !== undefined) &&
    (typeof options.message !== 'string' ||
      options.message.trim().length === 0 ||
      options.message.includes('\0'))
  ) {
    throw new Error('btp requires a non-empty --message without NUL characters')
  }
  const projectRoot =
    context.projectName && context.projectsConfigurations?.projects[context.projectName]?.root
  if (!projectRoot || !/^packages\/carmbo\/carmbo-[a-z]+(?:-[a-z]+)*$/.test(projectRoot)) {
    throw new Error('btp must run in a configured Carmbo package')
  }
  const root = realpathSync(context.root)
  const cwd = realpathSync(resolve(root, projectRoot))
  if (relative(root, cwd) !== projectRoot) {
    throw new Error('The package directory must not escape or redirect outside its project root')
  }
  const env = {...process.env, CI: '1', FORCE_COLOR: '1'}
  const commandOptions = {cwd, env}
  const prefix = basename(cwd)
    .split('-')
    .map((word) => word[0])
    .join('')

  function checkStaging(): void {
    const staged = runner('git', ['diff', '--cached', '--no-renames', '--name-only', '-z'], {
      cwd: root,
      env,
      captureOutput: true,
    })
    if (staged === null) throw new Error('Cannot inspect staged Git changes')
    const unrelated = staged
      .split('\0')
      .filter((path) => path && !path.startsWith(`${projectRoot}/`))
    if (unrelated.length > 0) {
      throw new Error(
        `Unrelated staged changes must be unstaged before publishing: ${unrelated.join(', ')}`,
      )
    }
  }

  checkStaging()
  const manifestFile = readManifest(cwd)
  const {manifest} = manifestFile
  const published = fetchPublishedVersions(cwd, manifest, runner, env)
  if (published.has(manifest.version)) {
    const changes = changesSinceRelease({root, projectRoot, manifest}, runner, env)
    console.log(describeChanges(projectRoot, changes))
    if (isUnchanged(changes)) {
      console.log(`${manifest.name}@${manifest.version} is already published; skipping`)
      return {success: true}
    }
  }
  if (dryRun) {
    const version = selectVersion(manifest.version, published)
    console.log(`Dry run: would update dependencies within their ranges, build, and test`)
    console.log(`Dry run: would publish ${manifest.name}@${version}`)
    if (options.message !== undefined) {
      console.log(`Dry run: would commit "${prefix}: ${options.message}"`)
    }
    console.log(`Dry run: would tag ${releaseTag(projectRoot, version)} and push`)
    return {success: true}
  }
  const version = applyNextVersion(manifestFile, published)
  runner('pnpm', ['update'], commandOptions)
  runner('pnpm', ['--if-present', 'build'], commandOptions)
  if (!Object.hasOwn(process.env, 'NO_TESTS')) {
    runner('pnpm', ['--if-present', 'test'], commandOptions)
  }
  runner('pnpm', ['publish', '--no-git-checks'], commandOptions)
  checkStaging()
  runner('git', ['add', '--', '.'], commandOptions)
  runner(
    'git',
    ['commit', '-m', `${prefix}: ${options.message}`, '--trailer', coauthor],
    commandOptions,
  )
  const tag = releaseTag(projectRoot, version)
  runner('git', ['tag', '--annotate', tag, '--message', tag], commandOptions)
  runner('git', ['push', '--follow-tags'], commandOptions)
  return {success: true}
}
