import assert from 'node:assert/strict'
import {describe, test} from 'node:test'
import {createMonorepo} from './monorepo.ts'

// Every monorepo starts with each package's version 1.0.0 published, committed, and pushed, but
// without a release tag, as if released manually. Each test has its own registry, origin, and
// folders, so they run concurrently.
describe('nx btp', {concurrency: true}, () => {
  test('a changed package is built, tested, published, committed, tagged, and pushed', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )

    const result = await mono.nx('btp', 'carmbo-alpha', '--message', 'add bye')

    assert.equal(result.code, 0, result.output)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0', '1.0.1'])
    assert.match(await mono.publishedFile('carmbo-alpha', '1.0.1', 'dist/index.js'), /bye/)
    assert.equal(mono.version('carmbo-alpha'), '1.0.1')
    assert.deepEqual(mono.remoteCommits(), ['ca: add bye', 'initial'])
    assert.match(mono.git('log', '-1', '--format=%b'), /^Co-authored-by: Copilot/m)
    assert.deepEqual(mono.remoteTags(), ['carmbo-alpha@1.0.1'])
  })

  test('a package that was never published is published at its local version', async (t) => {
    const mono = await createMonorepo(t, [{name: 'carmbo-alpha', dependsOn: [], unpublished: true}])

    const result = await mono.nx('btp', 'carmbo-alpha', '--message', 'first release')

    assert.equal(result.code, 0, result.output)
    assert.match(result.output, /@fixture\/carmbo-alpha is not in the registry yet/)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0'])
    assert.equal(mono.version('carmbo-alpha'), '1.0.0')
    // The package was already committed, so the release only tags that commit.
    assert.deepEqual(mono.remoteCommits(), ['initial'])
    assert.deepEqual(mono.remoteTags(), ['carmbo-alpha@1.0.0'])
  })

  test('an unchanged package is not published again', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])

    const result = await mono.nx('btp', 'carmbo-alpha', '--message', 'nothing to do')

    assert.equal(result.code, 0, result.output)
    assert.match(result.output, /carmbo-alpha: unchanged since \w{7} \(history\)/)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0'])
    assert.deepEqual(mono.remoteCommits(), ['initial'])
    assert.deepEqual(mono.remoteTags(), [])
  })

  test('after a release, publishing again is skipped based on the release tag', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )
    assert.equal((await mono.nx('btp', 'carmbo-alpha', '--msg', 'first')).code, 0)

    const result = await mono.nx('btp', 'carmbo-alpha', '--msg', 'second')

    assert.equal(result.code, 0, result.output)
    assert.match(result.output, /carmbo-alpha: unchanged since carmbo-alpha@1\.0\.1 \(tag\)/)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0', '1.0.1'])
    assert.deepEqual(mono.remoteCommits(), ['ca: first', 'initial'])
  })

  test('changes to excluded files (tests) and ignored files (build output) are not published', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])
    mono.write(
      'carmbo-alpha',
      'test/another.test.js',
      "import test from 'node:test'\ntest('x', () => {})\n",
    )
    mono.write('carmbo-alpha', 'dist/index.js', 'stale build output\n')

    const result = await mono.nx('btp', 'carmbo-alpha', '--msg', 'only tests changed')

    assert.equal(result.code, 0, result.output)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0'])
    assert.deepEqual(mono.remoteCommits(), ['initial'])
  })

  test('a change to a build input that is not published still triggers a release', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])
    mono.write(
      'carmbo-alpha',
      'build.js',
      "import {cpSync, appendFileSync} from 'node:fs'\n" +
        "cpSync('src', 'dist', {recursive: true})\n" +
        "appendFileSync('dist/index.js', 'export const built = true\\n')\n",
    )

    const result = await mono.nx('btp', 'carmbo-alpha', '--msg', 'change the build')

    assert.equal(result.code, 0, result.output)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0', '1.0.1'])
    assert.match(await mono.publishedFile('carmbo-alpha', '1.0.1', 'dist/index.js'), /built/)
  })

  test('failing tests stop the release before anything is published or committed', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])
    mono.write('carmbo-alpha', 'src/index.js', "export const greeting = 'goodbye'\n")

    const result = await mono.nx('btp', 'carmbo-alpha', '--msg', 'break the tests')

    assert.notEqual(result.code, 0)
    assert.match(result.output, /greets/)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0'])
    assert.deepEqual(mono.remoteCommits(), ['initial'])
    assert.deepEqual(mono.remoteTags(), [])
    // The version bump stays in the working tree, so the next attempt publishes 1.0.1.
    assert.equal(mono.version('carmbo-alpha'), '1.0.1')
  })

  test('NO_TESTS skips the tests and publishes anyway', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])
    mono.write('carmbo-alpha', 'src/index.js', "export const greeting = 'goodbye'\n")

    const result = await mono.nxWithEnv({NO_TESTS: ''}, 'btp', 'carmbo-alpha', '--msg', 'skip')

    assert.equal(result.code, 0, result.output)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0', '1.0.1'])
  })

  test('unrelated staged changes abort the release before anything happens', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha', 'carmbo-beta'])
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )
    mono.write(
      'carmbo-beta',
      'src/index.js',
      "export const greeting = 'hello'\nexport const hi = 1\n",
    )
    mono.git('add', 'packages/carmbo/carmbo-beta')

    const result = await mono.nx('btp', 'carmbo-alpha', '--msg', 'add bye')

    assert.notEqual(result.code, 0)
    assert.match(result.output, /Unrelated staged changes .*carmbo-beta\/src\/index\.js/)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0'])
    assert.equal(mono.version('carmbo-alpha'), '1.0.0')
    assert.deepEqual(mono.remoteCommits(), ['initial'])
  })

  test('releasing one package commits only that package and leaves the others alone', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha', 'carmbo-beta'])
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )
    mono.write(
      'carmbo-beta',
      'src/index.js',
      "export const greeting = 'hello'\nexport const hi = 1\n",
    )

    const result = await mono.nx('btp', 'carmbo-alpha', '--msg', 'add bye')

    assert.equal(result.code, 0, result.output)
    assert.deepEqual(mono.remoteCommitFiles(), [
      'packages/carmbo/carmbo-alpha/package.json',
      'packages/carmbo/carmbo-alpha/src/index.js',
    ])
    assert.deepEqual(await mono.publishedVersions('carmbo-beta'), ['1.0.0'])
    assert.match(mono.read('carmbo-beta', 'src/index.js'), /hi/)
    assert.match(mono.git('status', '--porcelain'), /carmbo-beta\/src\/index\.js/)
  })

  test('the commit message is used literally, prefixed with the package initials', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )
    const message = `say "bye" to $HOME and $(whoami) and \`date\``

    const result = await mono.nx('btp', 'carmbo-alpha', `--msg=${message}`)

    assert.equal(result.code, 0, result.output)
    assert.deepEqual(mono.remoteCommits(), [`ca: ${message}`, 'initial'])
  })

  test('a commit message is required', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )

    const result = await mono.nx('btp', 'carmbo-alpha')

    assert.notEqual(result.code, 0)
    assert.match(result.output, /btp requires a non-empty --message/)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0'])
    assert.deepEqual(mono.remoteCommits(), ['initial'])
  })

  test('a dry run of a changed package reports the release without changing anything', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )
    const statusBefore = mono.git('status', '--porcelain')

    const result = await mono.nx('btp', 'carmbo-alpha', '--dry-run', '--msg', 'add bye')

    assert.equal(result.code, 0, result.output)
    assert.match(result.output, /carmbo-alpha: changed since \w{7} \(history\): src\/index\.js/)
    assert.match(result.output, /Dry run: would publish @fixture\/carmbo-alpha@1\.0\.1/)
    assert.match(result.output, /Dry run: would commit "ca: add bye"/)
    assert.match(result.output, /Dry run: would tag carmbo-alpha@1\.0\.1 and push/)
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0'])
    assert.equal(mono.version('carmbo-alpha'), '1.0.0')
    assert.equal(mono.git('status', '--porcelain'), statusBefore)
    assert.deepEqual(mono.remoteCommits(), ['initial'])
    assert.deepEqual(mono.remoteTags(), [])
  })

  test('a dry run of an unchanged package reports that it would be skipped', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha'])

    const result = await mono.nx('btp', 'carmbo-alpha', '--dry-run')

    assert.equal(result.code, 0, result.output)
    assert.match(result.output, /@fixture\/carmbo-alpha@1\.0\.0 is already published; skipping/)
    assert.doesNotMatch(result.output, /would publish/)
  })

  test('a dry run fails when the real release would abort', async (t) => {
    const mono = await createMonorepo(t, ['carmbo-alpha', 'carmbo-beta'])
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )
    mono.write(
      'carmbo-beta',
      'src/index.js',
      "export const greeting = 'hello'\nexport const hi = 1\n",
    )
    mono.git('add', 'packages/carmbo/carmbo-beta')

    const result = await mono.nx('btp', 'carmbo-alpha', '--dry-run')

    assert.notEqual(result.code, 0)
    assert.match(result.output, /Unrelated staged changes/)
  })

  test('btp releases changed dependencies first, forwarding the message', async (t) => {
    const mono = await createMonorepo(t, [
      'carmbo-beta',
      {name: 'carmbo-alpha', dependsOn: ['carmbo-beta']},
    ])
    mono.write(
      'carmbo-beta',
      'src/index.js',
      "export const greeting = 'hello'\nexport const hi = 1\n",
    )
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )

    const result = await mono.nx('btp', 'carmbo-alpha', '--msg', 'release both')

    assert.equal(result.code, 0, result.output)
    assert.deepEqual(await mono.publishedVersions('carmbo-beta'), ['1.0.0', '1.0.1'])
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0', '1.0.1'])
    assert.deepEqual(mono.remoteCommits(), ['ca: release both', 'cb: release both', 'initial'])
    assert.deepEqual(mono.remoteTags(), ['carmbo-alpha@1.0.1', 'carmbo-beta@1.0.1'])
  })

  test('a released package is updated, within its ranges, to its newly released dependencies', async (t) => {
    // pnpm update moves to the newest versions within the ranges, in both the lockfile and the
    // ranges' lower bounds in package.json.
    const mono = await createMonorepo(t, [
      'carmbo-beta',
      {name: 'carmbo-alpha', dependsOn: ['carmbo-beta']},
    ])
    mono.write(
      'carmbo-beta',
      'src/index.js',
      "export const greeting = 'hello'\nexport const hi = 1\n",
    )
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )

    const result = await mono.nx('btp', 'carmbo-alpha', '--msg', 'release both')

    assert.equal(result.code, 0, result.output)
    const published = JSON.parse(await mono.publishedFile('carmbo-alpha', '1.0.1', 'package.json'))
    assert.deepEqual(published.dependencies, {'@fixture/carmbo-beta': '^1.0.1'})
    assert.match(mono.read('carmbo-alpha', 'pnpm-lock.yaml'), /'?@fixture\/carmbo-beta'?@1\.0\.1/)
    assert.doesNotMatch(mono.read('carmbo-alpha', 'pnpm-lock.yaml'), /carmbo-beta'?@1\.0\.0/)
    assert.ok(
      mono.remoteCommitFiles().includes('packages/carmbo/carmbo-alpha/pnpm-lock.yaml'),
      'the updated lockfile is part of the release commit',
    )
  })

  test('btp skips unchanged dependencies and releases only what changed', async (t) => {
    const mono = await createMonorepo(t, [
      'carmbo-beta',
      {name: 'carmbo-alpha', dependsOn: ['carmbo-beta']},
    ])
    mono.write(
      'carmbo-beta',
      'src/index.js',
      "export const greeting = 'hello'\nexport const hi = 1\n",
    )

    const result = await mono.nx('btp', 'carmbo-alpha', '--msg', 'only beta')

    assert.equal(result.code, 0, result.output)
    assert.match(result.output, /carmbo-alpha: unchanged since/)
    assert.deepEqual(await mono.publishedVersions('carmbo-beta'), ['1.0.0', '1.0.1'])
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0'])
    assert.deepEqual(mono.remoteCommits(), ['cb: only beta', 'initial'])
    // Unchanged packages are not updated: consumers of alpha get beta 1.0.1 through ^1.0.0 anyway.
    assert.match(mono.read('carmbo-alpha', 'package.json'), /"@fixture\/carmbo-beta": "\^1\.0\.0"/)
  })

  test('a dry run is forwarded to dependencies, so nothing is published', async (t) => {
    const mono = await createMonorepo(t, [
      'carmbo-beta',
      {name: 'carmbo-alpha', dependsOn: ['carmbo-beta']},
    ])
    mono.write(
      'carmbo-beta',
      'src/index.js',
      "export const greeting = 'hello'\nexport const hi = 1\n",
    )

    const result = await mono.nx('btp', 'carmbo-alpha', '--dry-run')

    assert.equal(result.code, 0, result.output)
    assert.match(result.output, /Dry run: would publish @fixture\/carmbo-beta@1\.0\.1/)
    assert.deepEqual(await mono.publishedVersions('carmbo-beta'), ['1.0.0'])
    assert.deepEqual(mono.remoteCommits(), ['initial'])
  })

  test('a failing dependency stops its dependents from being released', async (t) => {
    const mono = await createMonorepo(t, [
      'carmbo-beta',
      {name: 'carmbo-alpha', dependsOn: ['carmbo-beta']},
    ])
    mono.write('carmbo-beta', 'src/index.js', "export const greeting = 'goodbye'\n")
    mono.write(
      'carmbo-alpha',
      'src/index.js',
      "export const greeting = 'hello'\nexport const bye = 1\n",
    )

    const result = await mono.nx('btp', 'carmbo-alpha', '--msg', 'beta breaks')

    assert.notEqual(result.code, 0)
    assert.deepEqual(await mono.publishedVersions('carmbo-beta'), ['1.0.0'])
    assert.deepEqual(await mono.publishedVersions('carmbo-alpha'), ['1.0.0'])
    assert.deepEqual(mono.remoteCommits(), ['initial'])
  })
})
