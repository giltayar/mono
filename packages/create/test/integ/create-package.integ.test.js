import path from 'path'
import fs from 'fs'
import {describe, it, before, after} from '@seasquared/mocha-commons'
import chai from 'chai'
const {expect} = chai
import {makeTemporaryDirectory, readFileAsString, writeFile} from '@seasquared/scripting-commons'
import {sh, shWithOutput} from '@seasquared/scripting-commons'
import {startNpmRegistry} from '@bilt/npm-testkit'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('create-package (integ)', function () {
  const {close, registry} = before(async () => await startNpmRegistry({shouldProxyToNpmJs: true}))
  after(() => close()?.())

  it('should create the "library" package', async () => {
    const {target, packageName} = await createPackage('library')

    expect(await readFileAsString(['src', `${packageName}.js`], {cwd: target})).to.include('export')
    await runScript('install', target)
    await runScript('run build --if-present', target)
    await runScript('test', target)
    await runScriptForNpmPublishing('publish', target, registry())

    expect(
      await npmWithOutputForNpmPublishing(
        `view @seasquared/${packageName} version`,
        target,
        registry(),
      ),
    ).to.equal('1.0.0\n')
  })

  it('should create the "cli" package', async () => {
    const {target, packageName} = await createPackage('cli')

    expect(await readFileAsString(['src', `${packageName}.js`], {cwd: target})).to.include('export')
    await runScript('install', target)
    await runScript('run build --if-present', target)
    await runScript('test', target)
    await runScriptForNpmPublishing('publish', target, registry())

    expect(
      await npmWithOutputForNpmPublishing(
        `view @seasquared/${packageName} version`,
        target,
        registry(),
      ),
    ).to.equal('1.0.0\n')
  })

  it('should create the "fastify-plugin" package', async () => {
    const {target, packageName} = await createPackage('fastify-plugin')

    expect(await readFileAsString(['src', `${packageName}.js`], {cwd: target})).to.include('export')
    await runScript('install', target)
    await runScript('run build --if-present', target)
    await runScript('test', target)
    await runScriptForNpmPublishing('publish', target, registry())

    expect(
      await npmWithOutputForNpmPublishing(
        `view @seasquared/${packageName} version`,
        target,
        registry(),
      ),
    ).to.equal('1.0.0\n')
  })

  it('should create the "web-app" package', async () => {
    const {target, packageName} = await createPackage('web-app')

    expect(await readFileAsString(['src', `${packageName}.js`], {cwd: target})).to.include('export')
    await runScript('install', target)
    await runScript('run build --if-present', target)
    await runScript('test', target)
    await runScriptForNpmPublishing('publish', target, registry())

    expect(
      await npmWithOutputForNpmPublishing(
        `view @seasquared/${packageName} version`,
        target,
        registry(),
      ),
    ).to.equal('1.0.0\n')
  })

  it('should create the "web-app-with-crud" package', async () => {
    const {target, packageName} = await createPackage('web-app-with-crud')

    expect(await readFileAsString(['src', `${packageName}.js`], {cwd: target})).to.include('export')
    await runScript('install', target)
    await runScript('run build --if-present', target)
    await runScript('test', target)
    await runScriptForNpmPublishing('publish', target, registry())

    expect(
      await npmWithOutputForNpmPublishing(
        `view @seasquared/${packageName} version`,
        target,
        registry(),
      ),
    ).to.equal('1.0.0\n')
  })
})

/**
 *
 * @param {string} template
 * @returns {Promise<{target: string, packageName: string}>}
 */
async function createPackage(template) {
  const target = await makeTemporaryDirectory()
  const packageName = path.basename(target)

  await sh(`${path.resolve(__dirname, '../../src/create-package.js')} ${template}`, {cwd: target})

  return {target, packageName}
}

/**
 *
 * @param {string} scriptName
 * @param {string} target
 * @returns {Promise<void>}
 */
async function runScript(scriptName, target) {
  await sh(`npm ${scriptName}`, {cwd: target})
}

/**
 *
 * @param {string} scriptName
 * @param {string} target
 * @param {string} registry
 * @returns {Promise<void>}
 */
async function runScriptForNpmPublishing(scriptName, target, registry) {
  await writeFile('.npmrc', `registry=${registry}`, {cwd: target})

  await sh(`npm ${scriptName}`, {cwd: target})

  await fs.promises.unlink(path.resolve(target, '.npmrc'))
}

/**
 *
 * @param {string} scriptName
 * @param {string} target
 * @param {string} registry
 * @returns {Promise<string>}
 */
async function npmWithOutputForNpmPublishing(scriptName, target, registry) {
  await writeFile('.npmrc', `registry=${registry}`, {cwd: target})

  const ret = await shWithOutput(`npm ${scriptName}`, {cwd: target})

  await fs.promises.unlink(path.resolve(target, '.npmrc'))

  return ret
}
