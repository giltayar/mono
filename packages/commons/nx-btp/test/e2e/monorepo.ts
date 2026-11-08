import assert from 'node:assert/strict'
import {execFile, execFileSync} from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import type {AddressInfo} from 'node:net'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify} from 'node:util'
import type {TestContext} from 'node:test'
import {runServer} from 'verdaccio'

const execFileAsync = promisify(execFile)
const nxBtp = fileURLToPath(new URL('../..', import.meta.url))
const nxBin = join(nxBtp, 'node_modules/nx/dist/bin/nx.js')

// Each in-process Verdaccio adds a process exit listener, and scenarios run concurrently.
process.setMaxListeners(50)

export type CommandResult = {code: number; output: string}

export type Monorepo = {
  root: string
  /** Absolute path of a fake package folder. */
  packageDir(name: string): string
  /** Write a file inside a fake package, creating folders as needed. */
  write(name: string, path: string, content: string): void
  read(name: string, path: string): string
  /** The version currently in the package's local package.json. */
  version(name: string): string
  git(...args: string[]): string
  commitAll(message: string): void
  /** Run the real Nx CLI from the monorepo root. Never throws; check `code`. */
  nx(...args: string[]): Promise<CommandResult>
  nxWithEnv(env: NodeJS.ProcessEnv, ...args: string[]): Promise<CommandResult>
  publishedVersions(name: string): Promise<string[]>
  /** Content of a file inside a published tarball. */
  publishedFile(name: string, version: string, path: string): Promise<string>
  /** Commit subjects on origin/main, newest first. */
  remoteCommits(): string[]
  /** Files changed by a commit on origin/main (default: the newest). */
  remoteCommitFiles(ref?: string): string[]
  remoteTags(): string[]
}

const fakeTest = `import assert from 'node:assert/strict'
import test from 'node:test'
import {greeting} from '../src/index.js'

test('greets', () => assert.equal(greeting, 'hello'))
`

const fakeBuild = `import {cpSync} from 'node:fs'

cpSync('src', 'dist', {recursive: true})
`

/**
 * A fake package and the fake packages it depends on (as `^1.0.0`, their published version).
 * `unpublished` packages are committed but never published, like a brand-new package.
 */
export type FakePackage = string | {name: string; dependsOn: string[]; unpublished?: boolean}

/** Like the real packages: the targets are declared here, and defined by the nx-btp preset. */
const fakeTargets = {'start-btp': {}, btp: {}}

/** A small, self-contained package: source, a build step, a test, and release metadata. */
function writeFakePackage(dir: string, name: string, dependsOn: string[]): void {
  const files: Record<string, string> = {
    'package.json':
      JSON.stringify(
        {
          name: `@fixture/${name}`,
          version: '1.0.0',
          type: 'module',
          files: ['src', 'dist'],
          scripts: {build: 'node build.js', test: 'node --test'},
          dependencies: Object.fromEntries(dependsOn.map((dep) => [`@fixture/${dep}`, '^1.0.0'])),
          btp: {exclude: ['test/**', 'project.json']},
        },
        null,
        2,
      ) + '\n',
    'project.json': JSON.stringify({name, targets: fakeTargets}, null, 2) + '\n',
    '.gitignore': 'dist\nnode_modules\n',
    // Like the real packages: pnpm ignores versions younger than a day, except our own, so a
    // dependency released moments ago is picked up by its dependents' `pnpm update`.
    'pnpm-workspace.yaml': "minimumReleaseAge: 1440\nminimumReleaseAgeExclude:\n  - '@fixture/*'\n",
    'build.js': fakeBuild,
    'src/index.js': "export const greeting = 'hello'\n",
    'test/index.test.js': fakeTest,
  }
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), {recursive: true})
    writeFileSync(join(dir, path), content)
  }
}

async function startRegistry(t: TestContext, work: string): Promise<{url: string; token: string}> {
  const server = await runServer({
    self_path: work,
    storage: join(work, 'storage'),
    auth: {htpasswd: {file: join(work, 'htpasswd'), max_users: 10}},
    uplinks: {},
    packages: {'@fixture/*': {access: '$all', publish: '$authenticated'}},
    log: {type: 'stdout', format: 'pretty', level: 'fatal'},
  } as unknown as Parameters<typeof runServer>[0])
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  const response = await fetch(`${url}-/user/org.couchdb.user:tester`, {
    method: 'PUT',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({name: 'tester', password: 'tester-password'}),
  })
  const {token} = (await response.json()) as {token: string}
  assert.ok(token, 'Verdaccio did not return an auth token')
  return {url, token}
}

/** An environment that cannot reach real registries, real Git config, or the real monorepo. */
function isolatedEnvironment(work: string, registry: string, token: string): NodeJS.ProcessEnv {
  assert.match(registry, /^http:\/\/127\.0\.0\.1:\d+\/$/, 'tests must only publish locally')
  const home = join(work, 'home')
  mkdirSync(home)
  const npmrc = join(home, '.npmrc')
  writeFileSync(
    npmrc,
    `@fixture:registry=${registry}\n${registry.replace(/^http:/, '')}:_authToken=${token}\n`,
  )
  writeFileSync(
    join(home, '.gitconfig'),
    '[user]\n\tname = E2E Test\n\temail = e2e@example.invalid\n' +
      '[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n[tag]\n\tgpgsign = false\n',
  )
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/^(npm_|pnpm_|nx_|git_|node_test_context$|ci$|no_tests$|force_color$|no_color$)/i.test(
          key,
        ),
    ),
  )
  return {
    ...inherited,
    HOME: home,
    npm_config_userconfig: npmrc,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CEILING_DIRECTORIES: work,
    NX_DAEMON: 'false',
    NX_TUI: 'false',
    NX_NO_CLOUD: 'true',
    NX_PLUGIN_ISOLATION: 'false',
  }
}

async function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  try {
    const {stdout, stderr} = await execFileAsync(command, args, {
      cwd,
      env,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    })
    return {code: 0, output: stdout + stderr}
  } catch (error) {
    const {code, stdout, stderr} = error as {code?: number; stdout?: string; stderr?: string}
    return {code: typeof code === 'number' ? code : 1, output: `${stdout ?? ''}${stderr ?? ''}`}
  }
}

/**
 * Creates a fake monorepo whose packages each have version 1.0.0 published (unless `unpublished`)
 * to a private Verdaccio registry, committed, and pushed to a bare `origin` repository, without
 * release tags.
 * That mirrors packages whose first release was published manually. Packages are seeded in the
 * given order, so list dependencies before their dependents.
 */
export async function createMonorepo(t: TestContext, packages: FakePackage[]): Promise<Monorepo> {
  const work = realpathSync(mkdtempSync(join(tmpdir(), 'nx-btp-e2e-')))
  t.after(() => rmSync(work, {recursive: true, force: true}))
  const registry = await startRegistry(t, work)
  const env = isolatedEnvironment(work, registry.url, registry.token)
  const root = join(work, 'monorepo')
  const origin = join(work, 'origin.git')

  mkdirSync(join(root, 'packages/commons'), {recursive: true})
  symlinkSync(nxBtp, join(root, 'packages/commons/nx-btp'), 'dir')
  symlinkSync(join(nxBtp, 'node_modules'), join(root, 'node_modules'), 'dir')
  writeFileSync(join(root, 'package.json'), '{"private": true, "type": "module"}\n')
  writeFileSync(
    join(root, 'nx.json'),
    JSON.stringify({extends: './packages/commons/nx-btp/nx-preset.json', analytics: false}),
  )
  writeFileSync(join(root, '.gitignore'), 'node_modules\n.nx\npackages/commons/nx-btp\n')

  const packageDir = (name: string) => join(root, 'packages/carmbo', name)
  for (const fake of packages) {
    const {name, dependsOn, unpublished} =
      typeof fake === 'string' ? {name: fake, dependsOn: [], unpublished: false} : fake
    writeFakePackage(packageDir(name), name, dependsOn)
    const seeding = unpublished
      ? [['install']]
      : [['install'], ['run', 'build'], ['publish', '--no-git-checks']]
    for (const args of seeding) {
      const result = await run('pnpm', args, packageDir(name), env)
      assert.equal(result.code, 0, `seeding ${name}: pnpm ${args.join(' ')}\n${result.output}`)
    }
  }

  const gitIn = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, {cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})
  const git = (...args: string[]) => gitIn(root, ...args)
  const lines = (output: string) => output.split('\n').filter(Boolean)
  execFileSync('git', ['init', '--bare', origin], {env, stdio: 'ignore'})
  git('init')
  git('remote', 'add', 'origin', origin)
  git('add', '.')
  git('commit', '-m', 'initial')
  git('push', '--set-upstream', 'origin', 'main')

  const nxWithEnv = (extra: NodeJS.ProcessEnv, ...args: string[]) =>
    run(process.execPath, [nxBin, ...args, '--output-style=static'], root, {...env, ...extra})

  async function packument(name: string): Promise<{
    versions: Record<string, {dist: {tarball: string}}>
  }> {
    const response = await fetch(`${registry.url}${encodeURIComponent(`@fixture/${name}`)}`)
    assert.equal(response.status, 200, `@fixture/${name} is not in the registry`)
    return (await response.json()) as {versions: Record<string, {dist: {tarball: string}}>}
  }

  return {
    root,
    packageDir,
    write(name, path, content) {
      mkdirSync(dirname(join(packageDir(name), path)), {recursive: true})
      writeFileSync(join(packageDir(name), path), content)
    },
    read: (name, path) => readFileSync(join(packageDir(name), path), 'utf8'),
    version: (name) =>
      JSON.parse(readFileSync(join(packageDir(name), 'package.json'), 'utf8')).version,
    git,
    commitAll(message) {
      git('add', '.')
      git('commit', '-m', message)
    },
    nx: (...args) => nxWithEnv({}, ...args),
    nxWithEnv,
    publishedVersions: async (name) => Object.keys((await packument(name)).versions),
    async publishedFile(name, version, path) {
      const {tarball} = (await packument(name)).versions[version].dist
      const archive = join(work, `${name}-${version}.tgz`)
      writeFileSync(archive, Buffer.from(await (await fetch(tarball)).arrayBuffer()))
      return execFileSync('tar', ['-xOzf', archive, `package/${path}`], {encoding: 'utf8'})
    },
    remoteCommits: () => lines(gitIn(origin, 'log', '--format=%s', 'main')),
    remoteCommitFiles: (ref = 'main') =>
      lines(gitIn(origin, 'show', '--format=', '--name-only', ref)),
    remoteTags: () => lines(gitIn(origin, 'tag', '--list')),
  }
}
