import test from 'node:test'
import assert from 'node:assert/strict'
import {presult} from '@giltayar/promise-commons'
import path from 'path'
import fs from 'fs'
import {
  pathComponents,
  findFileThatMatches,
  makeTemporaryDirectory,
  readFileAsJson,
  readFileAsString,
  replaceInFile,
  writeFile,
} from '../../src/scripting-commons.ts'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

test('scripting-commons (integ) - pathComponents', () => {
  assert.deepEqual(pathComponents('/foo/bar/baz.txt'), {
    dirname: '/foo/bar',
    basename: 'baz.txt',
    extname: '.txt',
    filename: 'baz',
  })
  assert.deepEqual(pathComponents('/foo/bar/baz'), {
    dirname: '/foo/bar',
    basename: 'baz',
    extname: '',
    filename: 'baz',
  })
  assert.deepEqual(pathComponents('./foo/bar/baz.txt'), {
    dirname: './foo/bar',
    basename: 'baz.txt',
    extname: '.txt',
    filename: 'baz',
  })
  assert.deepEqual(pathComponents('baz.txt'), {
    dirname: '.',
    basename: 'baz.txt',
    extname: '.txt',
    filename: 'baz',
  })
})

test('scripting-commons (integ) - read/write/makeTemporaryDirectory - read/write files and make temporary dirs', async () => {
  const cwd = await makeTemporaryDirectory()

  await writeFile('foo.txt', 'hello', {cwd})
  await writeFile(['bar', 'bar.txt'], 'world', {cwd})
  await writeFile('foo.json', {hello: 'world'}, {cwd})

  assert.equal(await readFileAsString('foo.txt', {cwd}), 'hello')
  assert.equal(await readFileAsString(['bar', 'bar.txt'], {cwd}), 'world')
  assert.deepEqual(await readFileAsJson(['foo.json'], {cwd}), {hello: 'world'})
})

test('scripting-commons (integ) - read/write/makeTemporaryDirectory - copy directory to temp', async () => {
  const cwd = await makeTemporaryDirectory(path.resolve(__dirname, 'fixtures/source-dir'))

  assert.equal(fs.readdirSync(cwd).length, 3)
  assert.equal(fs.readdirSync(path.join(cwd, 'subdir')).length, 1)
  assert.equal(
    await readFileAsString('foo.txt', {cwd}),
    `
ABC
DEF
GHI
    `.trim(),
  )
  assert.equal(
    await readFileAsString('bar.txt', {cwd}),
    `
JKL
MNO
JKLAGAIN
    `.trim(),
  )
  assert.equal(await readFileAsString('subdir/gar.txt', {cwd}), `PQR`)
})

test('scripting-commons (integ) - read/write/makeTemporaryDirectory - copy with replacements', async () => {
  const cwd = await makeTemporaryDirectory(path.resolve(__dirname, 'fixtures/source-dir'), {
    JKL: 'LKJ',
    DEF: 'FED',
  })

  assert.equal(fs.readdirSync(cwd).length, 3)
  assert.equal(fs.readdirSync(path.join(cwd, 'subdir')).length, 1)
  assert.equal(
    await readFileAsString('foo.txt', {cwd}),
    `
ABC
FED
GHI
    `.trim(),
  )
  assert.equal(
    await readFileAsString('bar.txt', {cwd}),
    `
LKJ
MNO
LKJAGAIN
    `.trim(),
  )
  assert.equal(await readFileAsString('subdir/gar.txt', {cwd}), `PQR`)
})

test('scripting-commons (integ) - read/write/makeTemporaryDirectory - replaceInFile', async () => {
  const expectedTransform = 'Hello, wurld. You are a wonderful wurld!'
  const cwd = await makeTemporaryDirectory(path.join(__dirname, 'fixtures/replace-in-file'))

  assert.equal(await replaceInFile('a-file.txt', 'world', 'wurld', {cwd}), expectedTransform)
  assert.equal(await readFileAsString('a-file.txt', {cwd}), expectedTransform)
})

test('scripting-commons (integ) - findFileThatMatches - should find a file in a dir', async () => {
  const dir = path.join(__dirname, 'fixtures/source-dir')
  assert.equal(await findFileThatMatches(dir, /^ba/), path.join(dir, 'bar.txt'))
})

test('scripting-commons (integ) - findFileThatMatches - return undefined if no file', async () => {
  const dir = path.join(__dirname, 'fixtures/source-dir')
  assert.equal(await findFileThatMatches(dir, /^none/), undefined)
})

test('scripting-commons (integ) - findFileThatMatches - throw if more than one file matches', async () => {
  const dir = path.join(__dirname, 'fixtures/source-dir')
  const pres = await presult(findFileThatMatches(dir, /txt$/))
  const err = pres[0] as Error
  assert.equal(err.message, 'more than one file matches /txt$/: bar.txt,foo.txt')
  assert.equal((err as any).code, 'ERR_MORE_THAN_ONE_FILE_MATCH')
})
