import assert from 'node:assert/strict'
import {readFileSync, renameSync, symlinkSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import test from 'node:test'
import {publishExecutor} from '../../src/publish.ts'
import {runCommand} from '../../src/run-command.ts'
import {
  coauthor,
  fixture,
  initializeGit,
  projects,
  setNoTests,
  type CommandCall,
} from './fixtures.ts'

// The package-local staged-files check that decides whether there is anything to commit.
function isPackageDiff(args: readonly string[]): boolean {
  return args[0] === 'diff' && args.includes('--')
}

test('publishes sequentially with package-local commands and literal commit messages', async (t) => {
  const context = fixture(t)
  setNoTests(t)
  const calls: CommandCall[] = []
  const message = 'fix "quotes", \'apostrophes\', $HOME, $(echo nope); `echo nope`\nand a new line'
  const result = await publishExecutor({message}, context, (command, args, options) => {
    calls.push({command, args, options})
    if (isPackageDiff(args)) return 'package.json\0'
    return command === 'npm' ? '"0.9.0"' : options.captureOutput ? '' : null
  })
  assert.deepEqual(result, {success: true})
  assert.deepEqual(
    calls.map(({command, args}) => [command, ...args]),
    [
      ['git', 'diff', '--cached', '--no-renames', '--name-only', '-z'],
      ['npm', 'info', '@fixture/carmbo-pages-auth', 'versions', '--json'],
      ['pnpm', 'update'],
      ['pnpm', '--if-present', 'build'],
      ['pnpm', '--if-present', 'test'],
      ['pnpm', 'publish', '--no-git-checks'],
      ['git', 'diff', '--cached', '--no-renames', '--name-only', '-z'],
      ['git', 'add', '--', '.'],
      ['git', 'diff', '--cached', '--name-only', '-z', '--', '.'],
      ['git', 'commit', '-m', `cpa: ${message}`, '--trailer', coauthor],
      [
        'git',
        'tag',
        '--annotate',
        'carmbo-pages-auth@1.0.0',
        '--message',
        'carmbo-pages-auth@1.0.0',
      ],
      ['git', 'push', '--follow-tags'],
    ],
  )
  for (const {command, args, options} of calls) {
    const stagingCheck = command === 'git' && args[0] === 'diff' && !isPackageDiff(args)
    assert.equal(options.cwd, stagingCheck ? context.root : context.cwd)
    assert.equal(options.env.CI, '1')
    assert.equal(options.env.FORCE_COLOR, '1')
  }
})

for (const [name, prefix] of projects.map((name, index) => [
  name,
  ['ca', 'cc', 'cpa', 'cpc', 'cpj', 'cps', 'cps'][index],
])) {
  test(`prefixes ${name} commits with ${prefix}`, async (t) => {
    const context = fixture(t, name)
    const calls: CommandCall[] = []
    await publishExecutor({message: 'fix'}, context, (command, args, options) => {
      calls.push({command, args, options})
      if (isPackageDiff(args)) return 'package.json\0'
      return command === 'npm' ? '"0.9.0"' : ''
    })
    assert.equal(calls.find(({args}) => args[0] === 'commit')?.args[2], `${prefix}: fix`)
  })
}

for (const message of ['', ' \n\t', '\0bad']) {
  test('rejects missing or invalid commit messages before executing commands', async (t) => {
    await assert.rejects(
      publishExecutor({message}, fixture(t), () => assert.fail('No command should run')),
      /btp requires a non-empty --message/,
    )
  })

  test('rejects invalid commit messages even in a dry run', async (t) => {
    await assert.rejects(
      publishExecutor({message, dryRun: true}, fixture(t), () =>
        assert.fail('No command should run'),
      ),
      /btp requires a non-empty --message/,
    )
  })
}

test('a real publish requires a message', async (t) => {
  await assert.rejects(
    publishExecutor({}, fixture(t), () => assert.fail('No command should run')),
    /btp requires a non-empty --message/,
  )
})

test('a dry run only inspects: no version bump, no pnpm, and no Git writes', async (t) => {
  const context = fixture(t)
  const before = readFileSync(join(context.cwd, 'package.json'), 'utf8')
  const calls: CommandCall[] = []
  const result = await publishExecutor({dryRun: true}, context, (command, args, options) => {
    calls.push({command, args, options})
    return command === 'npm' ? '"0.9.0"' : ''
  })
  assert.deepEqual(result, {success: true})
  assert.deepEqual(
    calls.map(({command, args}) => [command, ...args]),
    [
      ['git', 'diff', '--cached', '--no-renames', '--name-only', '-z'],
      ['npm', 'info', '@fixture/carmbo-pages-auth', 'versions', '--json'],
    ],
  )
  assert.equal(readFileSync(join(context.cwd, 'package.json'), 'utf8'), before)
})

test('rejects a non-Carmbo project before executing commands', async (t) => {
  const context = fixture(t)
  context.projectsConfigurations.projects['carmbo-pages-auth'].root = 'packages/commons/example'
  await assert.rejects(
    publishExecutor({message: 'fix'}, context, () => assert.fail('No command should run')),
    /btp must run in a configured Carmbo package/,
  )
})

test('rejects a package directory redirected by a symlink', async (t) => {
  const context = fixture(t)
  const redirected = join(context.root, 'redirected')
  renameSync(context.cwd, redirected)
  symlinkSync(redirected, context.cwd, 'dir')
  await assert.rejects(
    publishExecutor({message: 'fix'}, context, () => assert.fail('No command should run')),
    /must not escape or redirect/,
  )
})

test('allows staged changes inside the current package', async (t) => {
  const context = fixture(t)
  await publishExecutor({message: 'fix'}, context, (command) =>
    command === 'npm' ? '"0.9.0"' : 'packages/carmbo/carmbo-pages-auth/src/index.ts\0',
  )
})

test('rechecks staging after publishing and stops before committing unrelated changes', async (t) => {
  const context = fixture(t)
  const calls: CommandCall[] = []
  let stagingChecks = 0
  await assert.rejects(
    publishExecutor({message: 'fix'}, context, (command, args, options) => {
      calls.push({command, args, options})
      if (command === 'npm') return '"0.9.0"'
      if (args[0] === 'diff' && ++stagingChecks === 2) return 'README.md\0'
      return ''
    }),
    /Unrelated staged changes/,
  )
  assert.ok(calls.some(({args}) => args[0] === 'publish'))
  assert.ok(!calls.some(({args}) => ['add', 'commit', 'tag', 'push'].includes(args[0])))
})

for (let failureIndex = 0; failureIndex < 12; failureIndex++) {
  test(`stops immediately when command ${failureIndex + 1} fails`, async (t) => {
    const context = fixture(t)
    setNoTests(t)
    const calls: CommandCall[] = []
    const error = new Error(`Command ${failureIndex + 1} failed`)
    await assert.rejects(
      publishExecutor({message: 'fix'}, context, (command, args, options) => {
        calls.push({command, args, options})
        if (calls.length === failureIndex + 1) throw error
        if (isPackageDiff(args)) return 'package.json\0'
        return command === 'npm' ? '"0.9.0"' : ''
      }),
      (caught) => caught === error,
    )
    assert.equal(calls.length, failureIndex + 1)
  })
}

test('real Git detects staged renames from outside into the package before publishing', async (t) => {
  const context = fixture(t)
  const unrelated = join(context.root, 'unrelated.txt')
  writeFileSync(unrelated, 'a file renamed across the package boundary\n')
  const git = initializeGit(context.root)
  git('mv', 'unrelated.txt', 'packages/carmbo/carmbo-pages-auth/renamed.txt')
  await assert.rejects(
    publishExecutor({message: 'fix'}, context, (command, args, options) => {
      assert.equal(command, 'git')
      return runCommand(command, args, options)
    }),
    /Unrelated staged changes.*unrelated\.txt/,
  )
  assert.equal(JSON.parse(readFileSync(join(context.cwd, 'package.json'), 'utf8')).version, '1.0.0')
})

test('tags and pushes without committing when the package has nothing to commit', async (t) => {
  const context = fixture(t)
  setNoTests(t, '1')
  const calls: CommandCall[] = []
  const result = await publishExecutor(
    {message: 'first release'},
    context,
    (command, args, options) => {
      calls.push({command, args, options})
      return command === 'npm' ? '"0.9.0"' : options.captureOutput ? '' : null
    },
  )
  assert.deepEqual(result, {success: true})
  assert.deepEqual(
    calls.slice(-4).map(({command, args}) => [command, ...args]),
    [
      ['git', 'add', '--', '.'],
      ['git', 'diff', '--cached', '--name-only', '-z', '--', '.'],
      [
        'git',
        'tag',
        '--annotate',
        'carmbo-pages-auth@1.0.0',
        '--message',
        'carmbo-pages-auth@1.0.0',
      ],
      ['git', 'push', '--follow-tags'],
    ],
  )
  assert.ok(!calls.some(({args}) => args[0] === 'commit'))
})
