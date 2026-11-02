import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {chmodSync, mkdirSync, readFileSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import test, {type TestContext} from 'node:test'
import {
  changesSinceRelease,
  describeChanges,
  excludeGlobs,
  findRelease,
  isUnchanged,
  releaseTag,
} from '../../src/package-changes.ts'
import {fixture, initializeGit, realGit, writeFile, writeManifest, type Git} from './fixtures.ts'

const projectRoot = 'packages/carmbo/carmbo-pages-auth'

type Repository = {root: string; cwd: string; git: Git}

function repository(t: TestContext, manifest: Record<string, unknown> = {}): Repository {
  const {root, cwd} = fixture(t)
  writeManifest(cwd, {name: '@fixture/carmbo-pages-auth', version: '1.0.0', ...manifest})
  writeFile(join(cwd, '.gitignore'), 'dist\n')
  writeFile(join(cwd, 'src/index.ts'), 'export const a = 1\n')
  writeFile(join(cwd, 'test/index.test.ts'), 'test\n')
  return {root, cwd, git: initializeGit(root)}
}

function manifestOf(cwd: string): Record<string, unknown> & {name: string; version: string} {
  return JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'))
}

function changes({root, cwd}: Repository) {
  return changesSinceRelease({root, projectRoot, manifest: manifestOf(cwd)}, realGit)
}

function commitAll(git: Git, message: string): string {
  git('add', '.')
  git('commit', '-m', message)
  return git('rev-parse', 'HEAD').trim()
}

function bump(repo: Repository, version: string): string {
  writeManifest(repo.cwd, {...manifestOf(repo.cwd), version})
  return commitAll(repo.git, `release ${version}`)
}

test('release tags use the package folder name and version', () => {
  assert.equal(releaseTag(projectRoot, '1.2.3'), 'carmbo-pages-auth@1.2.3')
})

test('an untouched package is unchanged since the commit that introduced its version', (t) => {
  const repo = repository(t)
  const result = changes(repo)
  assert.equal(result.release?.source, 'history')
  assert.equal(result.release?.commit, repo.git('rev-parse', 'HEAD').trim())
  assert.deepEqual(result.changedFiles, [])
  assert.ok(isUnchanged(result))
  assert.match(describeChanges(projectRoot, result), /carmbo-pages-auth: unchanged since \w{7}/)
})

test('history search uses the oldest consecutive commit with the local version', (t) => {
  const repo = repository(t)
  const release = bump(repo, '1.0.1')
  writeFile(join(repo.cwd, 'src/index.ts'), 'export const a = 2\n')
  commitAll(repo.git, 'change without a version bump')
  const result = changes(repo)
  assert.equal(result.release?.commit, release)
  assert.deepEqual(result.changedFiles, ['src/index.ts'])
  assert.ok(!isUnchanged(result))
})

test('a release tag is authoritative over the history search', (t) => {
  const repo = repository(t)
  writeFile(join(repo.cwd, 'src/index.ts'), 'export const a = 2\n')
  const tagged = commitAll(repo.git, 'change without a version bump')
  repo.git('tag', '--annotate', 'carmbo-pages-auth@1.0.0', '--message', 'release')
  const result = changes(repo)
  assert.deepEqual(result.release, {commit: tagged, source: 'tag', ref: 'carmbo-pages-auth@1.0.0'})
  assert.ok(isUnchanged(result))
})

test('lightweight release tags resolve to their commit', (t) => {
  const repo = repository(t)
  const tagged = repo.git('rev-parse', 'HEAD').trim()
  writeFile(join(repo.cwd, 'src/index.ts'), 'export const a = 2\n')
  commitAll(repo.git, 'later change')
  repo.git('tag', 'carmbo-pages-auth@1.0.0', tagged)
  const result = changes(repo)
  assert.deepEqual(result.release, {commit: tagged, source: 'tag', ref: 'carmbo-pages-auth@1.0.0'})
  assert.deepEqual(result.changedFiles, ['src/index.ts'])
})

test('tags only match their exact name', (t) => {
  const repo = repository(t)
  repo.git('tag', 'carmbo-pages-auth@1.0.0/other')
  repo.git('tag', 'carmbo-pages-auth@1.0.00')
  assert.equal(
    findRelease({root: repo.root, projectRoot, manifest: manifestOf(repo.cwd)}, realGit)?.source,
    'history',
  )
})

test('uncommitted, untracked, and deleted files count as changes', (t) => {
  const repo = repository(t)
  writeFile(join(repo.cwd, 'src/index.ts'), 'export const a = 2\n')
  writeFile(join(repo.cwd, 'src/new.ts'), 'export const b = 1\n')
  rmSync(join(repo.cwd, 'test/index.test.ts'))
  assert.deepEqual(changes(repo).changedFiles, ['src/index.ts', 'src/new.ts', 'test/index.test.ts'])
})

test('ignored files, such as build output, never count as changes', (t) => {
  const repo = repository(t)
  writeFile(join(repo.cwd, 'dist/index.js'), 'built\n')
  assert.ok(isUnchanged(changes(repo)))
})

test('changes outside the package, including similarly named folders, are ignored', (t) => {
  const repo = repository(t)
  writeFile(join(repo.root, 'packages/carmbo/carmbo-pages-auth-extra/index.ts'), 'other\n')
  writeFile(join(repo.root, 'README.md'), 'other\n')
  assert.ok(isUnchanged(changes(repo)))
})

test('btp.exclude globs drop matching files relative to the package', (t) => {
  const repo = repository(t, {btp: {exclude: ['test/**', 'project.json', 'AGENTS.md']}})
  writeFile(join(repo.cwd, 'test/index.test.ts'), 'changed\n')
  writeFile(join(repo.cwd, 'test/unit/new.test.ts'), 'new\n')
  writeFile(join(repo.cwd, 'project.json'), '{}\n')
  writeFile(join(repo.cwd, 'AGENTS.md'), 'notes\n')
  assert.ok(isUnchanged(changes(repo)))
  writeFile(join(repo.cwd, 'src/index.ts'), 'export const a = 2\n')
  assert.deepEqual(changes(repo).changedFiles, ['src/index.ts'])
})

test('package.json changes that only touch btp are ignored', (t) => {
  const repo = repository(t)
  writeManifest(repo.cwd, {...manifestOf(repo.cwd), btp: {exclude: ['test/**']}})
  assert.ok(isUnchanged(changes(repo)))
  writeManifest(repo.cwd, {...manifestOf(repo.cwd), dependencies: {a: '1.0.0'}})
  assert.deepEqual(changes(repo).changedFiles, ['package.json'])
})

test('no release commit means the package is treated as changed', (t) => {
  const repo = repository(t)
  writeManifest(repo.cwd, {...manifestOf(repo.cwd), version: '1.0.1'})
  const result = changes(repo)
  assert.equal(result.release, undefined)
  assert.ok(!isUnchanged(result))
  assert.equal(
    describeChanges(projectRoot, result),
    'carmbo-pages-auth: no release commit found; treating as changed',
  )
})

for (const btp of [null, [], 'test/**', {exclude: 'test/**'}, {exclude: [1]}]) {
  test(`rejects invalid btp configuration ${JSON.stringify(btp)}`, () => {
    assert.throws(() => excludeGlobs({btp}), /"btp" must be an object/)
  })
}

test('missing btp configuration excludes nothing', () => {
  assert.deepEqual(excludeGlobs({}), [])
  assert.deepEqual(excludeGlobs({btp: {}}), [])
})

test('the CLI reports publish status for each package directory', (t) => {
  const repo = repository(t)
  const other = join(repo.root, 'packages/carmbo/carmbo-pages-job')
  writeManifest(other, {name: '@fixture/carmbo-pages-job', version: '2.0.0'})
  commitAll(repo.git, 'add another package')
  writeFile(join(repo.cwd, 'src/index.ts'), 'export const a = 2\n')
  const third = join(repo.root, 'packages/carmbo/carmbo-pages-sale')
  writeManifest(third, {name: '@fixture/carmbo-pages-sale', version: '3.0.0'})
  commitAll(repo.git, 'add a third package')
  writeFile(join(repo.cwd, 'src/index.ts'), 'export const a = 3\n')

  const bin = join(repo.root, 'bin')
  mkdirSync(bin)
  writeFile(
    join(bin, 'npm'),
    `#!/bin/sh\ncase "$2" in\n  @fixture/carmbo-pages-sale) echo '"2.9.0"' ;;\n  *) echo '["1.0.0", "2.0.0"]' ;;\nesac\n`,
  )
  chmodSync(join(bin, 'npm'), 0o755)
  const output = execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../../src/package-changes.ts', import.meta.url)),
      repo.cwd,
      other,
      third,
    ],
    {
      cwd: repo.root,
      env: {...process.env, PATH: `${bin}:${process.env.PATH}`},
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  assert.match(
    output,
    /^carmbo-pages-auth: changed since \w{7} \(history\): src\/index\.ts; needs publish$/m,
  )
  assert.match(output, /^carmbo-pages-job: unchanged since \w{7} \(history\)$/m)
  assert.match(output, /^carmbo-pages-sale: 3\.0\.0 is not published; needs publish$/m)
})
