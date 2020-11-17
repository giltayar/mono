'use strict'
import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
const {expect, use} = chai
import chaiSubset from 'chai-subset'
use(chaiSubset)
import {presult} from '@seasquared/promise-commons'

import {
  sh,
  shWithOutput,
  makeTemporaryDirectory,
  writeFile,
  readFileAsString,
  readFileAsJson,
} from '../../src/scripting-commons.js'

describe('scripting-commons', function () {
  it('should output command output', async () => {
    const tmpDir = await makeTemporaryDirectory()

    await sh('touch bar', {cwd: tmpDir})
    await sh('touch foo', {cwd: tmpDir})
    const lsOutput = await shWithOutput('ls', {cwd: tmpDir})

    expect(lsOutput).to.equal('bar\nfoo\n')
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
})
