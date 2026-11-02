import {execFileSync} from 'node:child_process'
import {realpathSync} from 'node:fs'
import {basename, matchesGlob, relative, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import {
  fetchPublishedVersions,
  isObject,
  readManifest,
  type PackageManifest,
} from './next-package-version.ts'
import {runCommand, type CommandRunner} from './run-command.ts'

export type ReleaseReference = {commit: string; source: 'tag' | 'history'; ref: string}

export type PackageChanges = {release: ReleaseReference | undefined; changedFiles: string[]}

export type ChangeQuery = {
  root: string
  projectRoot: string
  manifest: PackageManifest
}

export function releaseTag(projectRoot: string, version: string): string {
  return `${basename(projectRoot)}@${version}`
}

export function excludeGlobs(manifest: Record<string, unknown>): string[] {
  const btp = manifest.btp
  if (btp === undefined) return []
  if (
    !isObject(btp) ||
    (btp.exclude !== undefined &&
      (!Array.isArray(btp.exclude) || !btp.exclude.every((glob) => typeof glob === 'string')))
  ) {
    throw new Error('package.json "btp" must be an object whose "exclude" is an array of globs')
  }
  return (btp.exclude as string[] | undefined) ?? []
}

function git(runner: CommandRunner, root: string, env: NodeJS.ProcessEnv, args: string[]): string {
  const output = runner('git', args, {cwd: root, env, captureOutput: true})
  if (output === null) throw new Error(`git ${args[0]} returned no output`)
  return output
}

function splitNul(output: string): string[] {
  return output.split('\0').filter(Boolean)
}

function versionAt(
  runner: CommandRunner,
  root: string,
  env: NodeJS.ProcessEnv,
  commit: string,
  path: string,
): unknown {
  try {
    const manifest: unknown = JSON.parse(git(runner, root, env, ['show', `${commit}:${path}`]))
    return isObject(manifest) ? manifest.version : undefined
  } catch {
    return undefined
  }
}

export function findRelease(
  {root, projectRoot, manifest}: ChangeQuery,
  runner: CommandRunner = runCommand,
  env: NodeJS.ProcessEnv = process.env,
): ReleaseReference | undefined {
  const tag = releaseTag(projectRoot, manifest.version)
  const tagged = git(runner, root, env, [
    'for-each-ref',
    '--format=%(refname) %(objectname) %(*objectname)',
    `refs/tags/${tag}`,
  ])
    .split('\n')
    .map((line) => line.split(' '))
    .find(([refname]) => refname === `refs/tags/${tag}`)
  if (tagged) {
    const [, object, peeled] = tagged
    return {commit: peeled || object, source: 'tag', ref: tag}
  }

  // Without a tag, the release commit is the oldest of the consecutive most recent commits
  // whose package.json still has the local version.
  const manifestPath = `${projectRoot}/package.json`
  let release: string | undefined
  for (const commit of git(runner, root, env, ['log', '--format=%H', '--', manifestPath])
    .split('\n')
    .filter(Boolean)) {
    if (versionAt(runner, root, env, commit, manifestPath) !== manifest.version) break
    release = commit
  }
  return release ? {commit: release, source: 'history', ref: release.slice(0, 7)} : undefined
}

function withoutBtp(manifest: unknown): unknown {
  if (!isObject(manifest)) return manifest
  const {btp: _btp, ...rest} = manifest
  return rest
}

export function changesSinceRelease(
  query: ChangeQuery,
  runner: CommandRunner = runCommand,
  env: NodeJS.ProcessEnv = process.env,
): PackageChanges {
  const excludes = excludeGlobs(query.manifest)
  const release = findRelease(query, runner, env)
  if (!release) return {release, changedFiles: []}

  const {root, projectRoot} = query
  const prefix = `${projectRoot}/`
  const paths = new Set([
    ...splitNul(
      git(runner, root, env, [
        'diff',
        '--no-renames',
        '--name-only',
        '-z',
        release.commit,
        '--',
        projectRoot,
      ]),
    ),
    ...splitNul(
      git(runner, root, env, [
        'ls-files',
        '--others',
        '--exclude-standard',
        '-z',
        '--',
        projectRoot,
      ]),
    ),
  ])
  const changedFiles = [...paths]
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length))
    .filter((path) => !excludes.some((glob) => matchesGlob(path, glob)))
    .filter((path) => {
      if (path !== 'package.json') return true
      try {
        const released: unknown = JSON.parse(
          git(runner, root, env, ['show', `${release.commit}:${prefix}package.json`]),
        )
        return !isDeepStrictEqual(withoutBtp(released), withoutBtp(query.manifest))
      } catch {
        return true
      }
    })
    .sort()
  return {release, changedFiles}
}

export function isUnchanged(changes: PackageChanges): boolean {
  return changes.release !== undefined && changes.changedFiles.length === 0
}

export function describeChanges(projectRoot: string, changes: PackageChanges): string {
  const name = basename(projectRoot)
  if (!changes.release) return `${name}: no release commit found; treating as changed`
  const since = `${changes.release.ref} (${changes.release.source})`
  return isUnchanged(changes)
    ? `${name}: unchanged since ${since}`
    : `${name}: changed since ${since}: ${changes.changedFiles.join(', ')}`
}

function main(directories: string[]): void {
  for (const directory of directories.length > 0 ? directories : [process.cwd()]) {
    const cwd = realpathSync(resolve(directory))
    const root = realpathSync(
      execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd, encoding: 'utf8'}).trim(),
    )
    const projectRoot = relative(root, cwd)
    const {manifest} = readManifest(cwd)
    if (!fetchPublishedVersions(cwd, manifest).has(manifest.version)) {
      console.log(`${basename(projectRoot)}: ${manifest.version} is not published; needs publish`)
      continue
    }
    const changes = changesSinceRelease({root, projectRoot, manifest})
    console.log(
      `${describeChanges(projectRoot, changes)}${isUnchanged(changes) ? '' : '; needs publish'}`,
    )
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2))
}
