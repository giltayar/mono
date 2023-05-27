import {presult} from '@giltayar/promise-commons'
import chai from 'chai'
import chaiSubset from 'chai-subset'
import mocha from 'mocha'
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
} from '../../src/scripting-commons.js'
const {describe, it} = mocha
const {expect, use} = chai
use(chaiSubset)

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('scripting-commons (integ)', function () {
  describe('pathComponents', () => {
    it('should extract path components from path', () => {
      expect(pathComponents('/foo/bar/baz.txt')).to.eql({
        dirname: '/foo/bar',
        basename: 'baz.txt',
        extname: '.txt',
        filename: 'baz',
      })
      expect(pathComponents('/foo/bar/baz')).to.eql({
        dirname: '/foo/bar',
        basename: 'baz',
        extname: '',
        filename: 'baz',
      })
      expect(pathComponents('./foo/bar/baz.txt')).to.eql({
        dirname: './foo/bar',
        basename: 'baz.txt',
        extname: '.txt',
        filename: 'baz',
      })
      expect(pathComponents('baz.txt')).to.eql({
        dirname: '.',
        basename: 'baz.txt',
        extname: '.txt',
        filename: 'baz',
      })
    })
  })

  describe('read/write/makeTemporaryDirectory', () => {
    it('should read/write files and make temporary dirs', async () => {
      const cwd = await makeTemporaryDirectory()

      await writeFile('foo.txt', 'hello', {cwd})
      await writeFile(['bar', 'bar.txt'], 'world', {cwd})
      await writeFile('foo.json', {hello: 'world'}, {cwd})

      expect(await readFileAsString('foo.txt', {cwd})).to.equal('hello')
      expect(await readFileAsString(['bar', 'bar.txt'], {cwd})).to.equal('world')
      expect(await readFileAsJson(['foo.json'], {cwd})).to.eql({hello: 'world'})
    })

    it('should copy directory to temp', async () => {
      const cwd = await makeTemporaryDirectory(path.resolve(__dirname, 'fixtures/source-dir'))

      expect(fs.readdirSync(cwd)).to.have.length(3)
      expect(fs.readdirSync(path.join(cwd, 'subdir'))).to.have.length(1)
      expect(await readFileAsString('foo.txt', {cwd})).to.equal(
        `
ABC
DEF
GHI
    `.trim(),
      )
      expect(await readFileAsString('bar.txt', {cwd})).to.equal(
        `
JKL
MNO
JKLAGAIN
    `.trim(),
      )
      expect(await readFileAsString('subdir/gar.txt', {cwd})).to.equal(`PQR`)
    })

    it('should copy with replacements', async () => {
      const cwd = await makeTemporaryDirectory(path.resolve(__dirname, 'fixtures/source-dir'), {
        JKL: 'LKJ',
        DEF: 'FED',
      })

      expect(fs.readdirSync(cwd)).to.have.length(3)
      expect(fs.readdirSync(path.join(cwd, 'subdir'))).to.have.length(1)
      expect(await readFileAsString('foo.txt', {cwd})).to.equal(
        `
ABC
FED
GHI
    `.trim(),
      )
      expect(await readFileAsString('bar.txt', {cwd})).to.equal(
        `
LKJ
MNO
LKJAGAIN
    `.trim(),
      )
      expect(await readFileAsString('subdir/gar.txt', {cwd})).to.equal(`PQR`)
    })

    it('should replaceInfFile', async () => {
      const expectedTransform = 'Hello, wurld. You are a wonderful wurld!'
      const cwd = await makeTemporaryDirectory(path.join(__dirname, 'fixtures/replace-in-file'))

      expect(await replaceInFile('a-file.txt', 'world', 'wurld', {cwd})).to.equal(expectedTransform)

      expect(await readFileAsString('a-file.txt', {cwd})).to.equal(expectedTransform)
    })
  })
  describe('findFileThatMatches', () => {
    it('should find a file in a dir', async () => {
      const dir = path.join(__dirname, 'fixtures/source-dir')
      expect(await findFileThatMatches(dir, /^ba/)).to.equal(path.join(dir, 'bar.txt'))
    })

    it('should return undefined if no file', async () => {
      const dir = path.join(__dirname, 'fixtures/source-dir')
      expect(await findFileThatMatches(dir, /^none/)).to.equal(undefined)
    })

    it('should throw if more than one file matches', async () => {
      const dir = path.join(__dirname, 'fixtures/source-dir')
      expect((await presult(findFileThatMatches(dir, /txt$/)))[0].message).to.equal(
        'more than one file matches /txt$/: bar.txt,foo.txt',
      )
      expect((await presult(findFileThatMatches(dir, /txt$/)))[0].code).to.equal(
        'ERR_MORE_THAN_ONE_FILE_MATCH',
      )
    })
  })
})
