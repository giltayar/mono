import {execFileSync} from 'node:child_process'
import {mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import type {TestContext} from 'node:test'
import type {ExecutorContext} from 'nx/src/config/misc-interfaces'
import {runCommand, type CommandOptions, type CommandRunner} from '../../src/run-command.ts'

export const projects = [
  'carmbo-app',
  'carmbo-commons',
  'carmbo-pages-auth',
  'carmbo-pages-community',
  'carmbo-pages-job',
  'carmbo-pages-sale',
  'carmbo-pages-student',
]

export type CommandCall = {command: string; args: readonly string[]; options: CommandOptions}

export const coauthor = 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'

const gitConfig = [
  '-c',
  'user.name=Nx Test',
  '-c',
  'user.email=nx-test@example.invalid',
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'tag.gpgsign=false',
  '-c',
  'init.defaultBranch=main',
]

export type Git = (...args: string[]) => string

export function initializeGit(root: string): Git {
  const git: Git = (...args) =>
    execFileSync('git', [...gitConfig, ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  git('init')
  git('add', '.')
  git('commit', '-m', 'initialize temporary fixture', '--trailer', coauthor)
  return git
}

export const realGit: CommandRunner = (command, args, options) =>
  runCommand(command, command === 'git' ? [...gitConfig, ...args] : args, {
    ...options,
    captureOutput: true,
  })

export function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), {recursive: true})
  writeFileSync(path, content)
}

export function writeManifest(cwd: string, manifest: Record<string, unknown>): void {
  writeFile(join(cwd, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
}

export function setNoTests(t: TestContext, value?: string): void {
  const previous = process.env.NO_TESTS
  t.after(() => {
    if (previous === undefined) delete process.env.NO_TESTS
    else process.env.NO_TESTS = previous
  })
  if (value === undefined) delete process.env.NO_TESTS
  else process.env.NO_TESTS = value
}

export function fixture(t: TestContext, name: string = 'carmbo-pages-auth'): ExecutorContext {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'mono-nx-test-')))
  t.after(() => rmSync(root, {recursive: true, force: true}))
  const projectRoot = `packages/carmbo/${name}`
  const cwd = join(root, projectRoot)
  mkdirSync(cwd, {recursive: true})
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({name: `@fixture/${name}`, version: '1.0.0'}, null, 2) + '\n',
  )
  return {
    root,
    cwd,
    projectName: name,
    projectsConfigurations: {version: 2, projects: {[name]: {root: projectRoot}}},
    nxJsonConfiguration: {},
    isVerbose: false,
    projectGraph: {nodes: {}, dependencies: {}},
  }
}
