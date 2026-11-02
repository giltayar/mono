import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import test from 'node:test'
import {fixture} from './fixtures.ts'

const packageRoot = fileURLToPath(new URL('../..', import.meta.url))
const nx = join(packageRoot, 'node_modules/nx/dist/bin/nx.js')

type LoggedCommand = {command: string; args: string[]; cwd: string; ci: string; color: string}

test('nx-btp exposes the source pnpm hook through its discovery shim', () => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  assert.equal(manifest.name, '@giltayar/nx-btp')
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
import assert from 'node:assert/strict'
import {hooks as source} from './src/.pnpmfile.mjs'
import {hooks as shim} from './.pnpmfile.mjs'
assert.equal(shim, source)
const config = {allowBuilds: {other: true}, customSetting: 'keep'}
assert.deepEqual(shim.updateConfig(config), {
  allowBuilds: {other: true, nx: true}, customSetting: 'keep',
})
assert.deepEqual(config, {allowBuilds: {other: true}, customSetting: 'keep'})
`,
    ],
    {cwd: packageRoot, stdio: ['ignore', 'pipe', 'pipe']},
  )
})

test('the preset runs tasks one at a time and defines the btp targets', () => {
  const preset = JSON.parse(readFileSync(join(packageRoot, 'nx-preset.json'), 'utf8'))
  assert.equal(preset.parallel, 1)
  assert.deepEqual(Object.keys(preset.targetDefaults), ['start-btp', 'btp'])
  for (const target of Object.values<{cache: boolean; parallelism: boolean}>(
    preset.targetDefaults,
  )) {
    assert.equal(target.cache, false)
    assert.equal(target.parallelism, false)
  }
  assert.equal(preset.targetDefaults.btp.executor, './packages/commons/nx-btp:btp')
  // Forwarding matters: without it, `nx btp <project> --dry-run` would really publish dependencies.
  assert.deepEqual(preset.targetDefaults.btp.dependsOn, [
    {target: 'btp', dependencies: true, params: 'forward'},
  ])
})

test('Nx CLI runs start-btp sequentially in the package, and the version CLI queries npm', (t) => {
  const {root, cwd} = fixture(t)
  const plugin = join(root, 'packages/commons/nx-btp')
  mkdirSync(join(plugin, 'src'), {recursive: true})
  for (const name of ['package.json', 'nx-preset.json', 'executors.json', 'publish.schema.json']) {
    copyFileSync(join(packageRoot, name), join(plugin, name))
  }
  for (const name of [
    'publish.ts',
    'next-package-version.ts',
    'package-changes.ts',
    'run-command.ts',
  ]) {
    copyFileSync(join(packageRoot, 'src', name), join(plugin, 'src', name))
  }
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({private: true, type: 'module', packageManager: 'pnpm@12.16.1'}),
  )
  writeFileSync(
    join(root, 'nx.json'),
    JSON.stringify({extends: './packages/commons/nx-btp/nx-preset.json', analytics: false}),
  )
  writeFileSync(
    join(cwd, 'project.json'),
    JSON.stringify({name: 'carmbo-pages-auth', targets: {'start-btp': {}, btp: {}}}),
  )
  symlinkSync(join(packageRoot, 'node_modules'), join(root, 'node_modules'), 'dir')
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const log = join(root, 'commands.jsonl')
  const stub = `#!/usr/bin/env node
import {appendFileSync} from 'node:fs'
import {basename} from 'node:path'
const command = basename(process.argv[1])
const args = process.argv.slice(2)
appendFileSync(process.env.COMMAND_LOG, JSON.stringify({
  command, args, cwd: process.cwd(), ci: process.env.CI, color: process.env.FORCE_COLOR,
}) + '\\n')
if (command === 'npm') console.log('["1.0.0", "1.0.1"]')
if (command === 'pnpm' && process.env.FAIL_PNPM === args[0]) process.exit(17)
`
  for (const command of ['git', 'npm', 'pnpm']) {
    const path = join(bin, command)
    writeFileSync(path, stub)
    chmodSync(path, 0o755)
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    COMMAND_LOG: log,
    NX_DAEMON: 'false',
    NX_PLUGIN_ISOLATION: 'false',
    NX_TUI: 'false',
    NX_NO_CLOUD: 'true',
    NX_SKIP_NX_CACHE: 'true',
    NX_WORKSPACE_ROOT_PATH: root,
    FORCE_COLOR: '0',
    CI: '1',
  }
  delete env.NO_TESTS
  delete env.FAIL_PNPM
  const runNx = (args: string[], overrides: NodeJS.ProcessEnv = {}) =>
    execFileSync(process.execPath, [nx, ...args], {
      cwd: root,
      env: {...env, ...overrides},
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const readLog = (): LoggedCommand[] =>
    existsSync(log)
      ? readFileSync(log, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : []

  assert.deepEqual(JSON.parse(runNx(['show', 'projects', '--json'])), ['carmbo-pages-auth'])
  writeFileSync(log, '')
  runNx(['start-btp', 'carmbo-pages-auth'])
  assert.deepEqual(
    readLog()
      .filter(({command}) => command === 'pnpm')
      .map(({args, cwd: commandCwd}) => [args, commandCwd]),
    [
      [['self-update'], cwd],
      [['update', '--latest'], cwd],
    ],
  )
  writeFileSync(log, '')
  assert.throws(() => runNx(['start-btp', 'carmbo-pages-auth'], {FAIL_PNPM: 'self-update'}))
  assert.deepEqual(
    readLog()
      .filter(({command}) => command === 'pnpm')
      .map(({args}) => args),
    [['self-update']],
  )

  writeFileSync(log, '')
  execFileSync(process.execPath, [join(plugin, 'src/next-package-version.ts')], {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.deepEqual(
    readLog().map(({command, args, cwd: commandCwd}) => [command, args, commandCwd]),
    [['npm', ['info', '@fixture/carmbo-pages-auth', 'versions', '--json'], cwd]],
  )
})
