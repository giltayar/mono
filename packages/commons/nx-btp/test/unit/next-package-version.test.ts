import assert from 'node:assert/strict'
import {readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import test from 'node:test'
import {nextPackageVersion} from '../../src/next-package-version.ts'
import {fixture, type CommandCall} from './fixtures.ts'

test('retains an unpublished version without rewriting the manifest', (t) => {
  const {cwd} = fixture(t)
  const before = readFileSync(join(cwd, 'package.json'), 'utf8')
  const calls: CommandCall[] = []
  assert.equal(
    nextPackageVersion(cwd, (command, args, options) => {
      calls.push({command, args, options})
      return '["0.9.0", "1.0.2"]'
    }),
    '1.0.0',
  )
  assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), before)
  assert.deepEqual(calls, [
    {
      command: 'npm',
      args: ['info', '@fixture/carmbo-pages-auth', 'versions', '--json'],
      options: {cwd, env: process.env, captureOutput: true},
    },
  ])
})

for (const [output, expected] of [
  ['"1.0.0"', '1.0.1'],
  ['["1.0.0", "1.0.1", "1.0.2", "1.0.4"]', '1.0.3'],
  ['[]', '1.0.0'],
]) {
  test(`selects ${expected} from registry output ${output}`, (t) => {
    const {cwd} = fixture(t)
    assert.equal(
      nextPackageVersion(cwd, () => output),
      expected,
    )
    assert.equal(JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version, expected)
  })
}

test('preserves exact formatting and nested version properties when bumping', (t) => {
  const {cwd} = fixture(t)
  const source =
    '{\r\n\t"nested": {"version":"1.0.0"},\r\n\t"label": "version",\r\n' +
    '\t"name":"@fixture/package",\r\n\t"version" : "1.0.0"\r\n}\r\n'
  writeFileSync(join(cwd, 'package.json'), source)
  nextPackageVersion(cwd, () => '["1.0.0"]')
  assert.equal(
    readFileSync(join(cwd, 'package.json'), 'utf8'),
    source.replace('"version" : "1.0.0"', '"version" : "1.0.1"'),
  )
})

test('increments patch values without numeric precision loss', (t) => {
  const {cwd} = fixture(t)
  writeFileSync(join(cwd, 'package.json'), '{"name":"example","version":"1.0.9007199254740992"}')
  assert.equal(
    nextPackageVersion(cwd, () => '"1.0.9007199254740992"'),
    '1.0.9007199254740993',
  )
})

test('uses the publishing registry and the supplied environment', (t) => {
  const {cwd} = fixture(t)
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({
      name: '@fixture/package',
      version: '1.0.0',
      publishConfig: {registry: 'https://npm.pkg.github.com/'},
    }),
  )
  const env = {CI: '1'}
  const calls: CommandCall[] = []
  nextPackageVersion(
    cwd,
    (command, args, options) => {
      calls.push({command, args, options})
      return '"0.9.0"'
    },
    env,
  )
  assert.deepEqual(calls, [
    {
      command: 'npm',
      args: [
        'info',
        '@fixture/package',
        'versions',
        '--json',
        '--registry',
        'https://npm.pkg.github.com/',
      ],
      options: {cwd, env, captureOutput: true},
    },
  ])
})

for (const manifest of [
  'null',
  '{}',
  '{',
  '{"name":"--unsafe","version":"1.0.0"}',
  '{"name":"a b","version":"1.0.0"}',
  '{"name":"example","version":"01.0.0"}',
  '{"name":"example","version":"1.0.0-beta.1"}',
  '{"name":"example","version":"1.0.0+build"}',
  '{"name":"example","version":"1.0"}',
  '{"name":"example","version":1}',
  '{"name":"example","version":"1.0.0","publishConfig":null}',
  '{"name":"example","version":"1.0.0","publishConfig":{"registry":false}}',
]) {
  test(`rejects invalid manifest ${manifest} before running npm`, (t) => {
    const {cwd} = fixture(t)
    writeFileSync(join(cwd, 'package.json'), manifest)
    assert.throws(() =>
      nextPackageVersion(cwd, () => assert.fail('npm must not run for an invalid manifest')),
    )
    assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), manifest)
  })
}

for (const output of [
  '',
  '{}',
  'null',
  '42',
  '[1]',
  '["1.0.0", null]',
  '{"error":{"code":"E404"}}',
]) {
  test(`rejects malformed registry output ${output} without mutation`, (t) => {
    const {cwd} = fixture(t)
    const before = readFileSync(join(cwd, 'package.json'), 'utf8')
    assert.throws(() => nextPackageVersion(cwd, () => output))
    assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), before)
  })
}

for (const code of ['E404', 'E401', 'E403', 'ENOTFOUND', 'ECONNRESET']) {
  test(`propagates ${code} without npm error output, and without mutation`, (t) => {
    const {cwd} = fixture(t)
    const before = readFileSync(join(cwd, 'package.json'), 'utf8')
    const error = new Error(code)
    assert.throws(
      () =>
        nextPackageVersion(cwd, () => {
          throw error
        }),
      (caught) => caught === error,
    )
    assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), before)
  })
}

// Shaped like the error `execFileSync` throws when `npm info --json` exits non-zero.
function npmFailure(code: string): Error & {stdout: string} {
  return Object.assign(new Error('Command failed: npm info'), {
    status: 1,
    stdout: JSON.stringify({error: {code, summary: `${code} summary`, detail: ''}}, null, 2),
    stderr: `npm error code ${code}\n`,
  })
}

test('treats a package that is not in the registry as having no published versions', (t) => {
  const {cwd} = fixture(t)
  const before = readFileSync(join(cwd, 'package.json'), 'utf8')
  assert.equal(
    nextPackageVersion(cwd, () => {
      throw npmFailure('E404')
    }),
    '1.0.0',
  )
  assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), before)
})

for (const output of ['E401', 'E403', 'E500']
  .map((code) => npmFailure(code).stdout)
  .concat(['', 'not json', '{"error":"E404"}'])) {
  test(`propagates npm failures with output ${JSON.stringify(output)} without mutation`, (t) => {
    const {cwd} = fixture(t)
    const before = readFileSync(join(cwd, 'package.json'), 'utf8')
    const error = Object.assign(new Error('Command failed: npm info'), {status: 1, stdout: output})
    assert.throws(
      () =>
        nextPackageVersion(cwd, () => {
          throw error
        }),
      (caught) => caught === error,
    )
    assert.equal(readFileSync(join(cwd, 'package.json'), 'utf8'), before)
  })
}
