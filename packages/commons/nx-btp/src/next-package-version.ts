import {readFileSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {runCommand, type CommandRunner} from './run-command.ts'

export type PackageManifest = Record<string, unknown> & {name: string; version: string}

export type ManifestFile = {path: string; source: string; manifest: PackageManifest}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function replaceVersion(source: string, version: string): string {
  let depth = 0
  for (const token of source.matchAll(/"(?:\\.|[^"\\])*"|[{}[\]]/g)) {
    if (token[0] === '{' || token[0] === '[') depth++
    else if (token[0] === '}' || token[0] === ']') depth--
    else if (depth === 1 && JSON.parse(token[0]) === 'version') {
      const end = token.index + token[0].length
      const value = source.slice(end).match(/^(\s*:\s*)"(?:\\.|[^"\\])*"/)
      if (value) {
        return (
          source.slice(0, end) +
          value[1] +
          JSON.stringify(version) +
          source.slice(end + value[0].length)
        )
      }
    }
  }
  throw new Error('Cannot locate the top-level package version')
}

export function readManifest(cwd: string): ManifestFile {
  const path = join(cwd, 'package.json')
  const source = readFileSync(path, 'utf8')
  const manifest: unknown = JSON.parse(source)
  if (
    !isObject(manifest) ||
    typeof manifest.name !== 'string' ||
    !/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(manifest.name) ||
    typeof manifest.version !== 'string' ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(manifest.version)
  ) {
    throw new Error(
      'package.json must have a valid package name and stable major.minor.patch version',
    )
  }
  return {path, source, manifest: manifest as PackageManifest}
}

export function fetchPublishedVersions(
  cwd: string,
  manifest: PackageManifest,
  runner: CommandRunner = runCommand,
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  const args = ['info', manifest.name, 'versions', '--json']
  if (manifest.publishConfig !== undefined) {
    if (!isObject(manifest.publishConfig)) {
      throw new Error('publishConfig must be an object')
    }
    const registry = manifest.publishConfig.registry
    if (registry !== undefined) {
      if (typeof registry !== 'string' || !/^https?:\/\//.test(registry)) {
        throw new Error('publishConfig.registry must be an HTTP(S) registry URL')
      }
      args.push('--registry', registry)
    }
  }

  const output = runner('npm', args, {cwd, env, captureOutput: true})
  if (output === null) throw new Error('npm info returned no version output')
  const response: unknown = JSON.parse(output)
  const versions = typeof response === 'string' ? [response] : response
  if (!Array.isArray(versions) || !versions.every((version) => typeof version === 'string')) {
    throw new Error('npm info must return a version string or an array of version strings')
  }
  return new Set<string>(versions)
}

export function selectVersion(current: string, published: ReadonlySet<string>): string {
  const [major, minor, patch] = current.split('.').map(BigInt)
  let candidatePatch = patch
  let version = current
  while (published.has(version)) {
    candidatePatch++
    version = `${major}.${minor}.${candidatePatch}`
  }
  return version
}

export function applyNextVersion(file: ManifestFile, published: ReadonlySet<string>): string {
  const {manifest} = file
  const version = selectVersion(manifest.version, published)
  if (version !== manifest.version) {
    writeFileSync(file.path, replaceVersion(file.source, version))
    console.log(`${manifest.name}: ${manifest.version} -> ${version}`)
  } else {
    console.log(`${manifest.name}: ${version} is not published; keeping it`)
  }
  return version
}

export function nextPackageVersion(
  cwd: string = process.cwd(),
  runner: CommandRunner = runCommand,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const file = readManifest(cwd)
  return applyNextVersion(file, fetchPublishedVersions(cwd, file.manifest, runner, env))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  nextPackageVersion()
}
