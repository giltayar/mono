import {presult} from '@giltayar/promise-commons'
import chai from 'chai'
import chaiSubset from 'chai-subset'
import mocha from 'mocha'
import path from 'path'
import fs from 'fs'
import {
  makeTemporaryDirectory,
  readFileAsJson,
  readFileAsString,
  sh,
  shWithOutput,
  writeFile,
} from '../../src/scripting-commons.js'
const {describe, it} = mocha
const {expect, use} = chai
use(chaiSubset)

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('scripting-commons (integ)', function () {
  it('should output command output', async () => {
    const tmpDir = await makeTemporaryDirectory()

    await sh('touch bar', {cwd: tmpDir})
    await sh('touch foo', {cwd: tmpDir})
    const lsOutput = await shWithOutput('ls', {cwd: tmpDir})

    expect(lsOutput).to.equal('bar\nfoo\n')
  })

  it('should support array commands', async () => {
    const tmpDir = await makeTemporaryDirectory()

    await sh(['echo', 'bart', '>bar'], {cwd: tmpDir})
    await shWithOutput(['echo', 'bart', '>barbie'], {cwd: tmpDir})

    const barOutput = await shWithOutput(['cat', 'bar'], {cwd: tmpDir})
    const barbieOutput = await shWithOutput(['cat', 'barbie'], {cwd: tmpDir})

    expect(barOutput).to.equal('bart\n')
    expect(barbieOutput).to.equal('bart\n')
  })

  it('should support env', async () => {
    const tmpDir = await makeTemporaryDirectory()

    await sh('echo bart > $BAR', {cwd: tmpDir, env: {BAR: 'bar'}})
    const lsOutput = await shWithOutput('cat $BAR', {cwd: tmpDir, env: {BAR: 'bar'}})

    expect(lsOutput).to.equal('bart\n')
  })

  it('should fail on bad command', async () => {
    expect(
      await presult(sh('this-executable-should-not-exist', {cwd: process.cwd()})),
    ).to.containSubset([{message: (m = 's') => /not found/.test(m), code: 127}, undefined])

    expect(
      await presult(shWithOutput('this-executable-should-not-exist', {cwd: process.cwd()})),
    ).to.containSubset([{message: (m = 's') => /not found/.test(m), code: 127}, undefined])
  })

  it('should fail on command that returns bad exit code', async () => {
    expect(
      await presult(sh('ls this-file-should-not-exist', {cwd: process.cwd()})),
    ).to.containSubset([{message: (m = 's') => /Command failed/.test(m)}, undefined])

    expect(
      await presult(shWithOutput('ls this-file-should-not-exist', {cwd: process.cwd()})),
    ).to.containSubset([{message: (m = 's') => /No such file or directory/.test(m)}, undefined])
  })

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
    `.trim(),
    )
    expect(await readFileAsString('subdir/gar.txt', {cwd})).to.equal(`PQR`)
  })
})
