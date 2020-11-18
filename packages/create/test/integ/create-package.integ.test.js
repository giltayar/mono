import path from 'path'
import mocha from 'mocha'
const {describe, it, before, after} = mocha
import chai from 'chai'
const {expect} = chai
import {makeTemporaryDirectory, readFileAsString, writeFile} from '@seasquared/scripting-commons'
import {sh, shWithOutput} from '@seasquared/scripting-commons'
import {startNpmRegistry} from '@bilt/npm-testkit'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('create-package (integ)', function () {
  /**@type {any} */
  let close
  /**@type {any} */
  let registry
  before(async () => ({close, registry} = await startNpmRegistry({shouldProxyToNpmJs: true})))
  after(() => close ?? close())

  it('should create the "library" package', async () => {
    const {target, packageName} = await createPackage('library', registry)

    expect(await readFileAsString(['src', `${packageName}.js`], {cwd: target})).to.include('export')
    await runScript('install', target)
    await runScript('run build --if-present', target)
    await runScript('test', target)
    await runScript('publish', target)

    expect(
      await shWithOutput(`npm view @seasquared/${packageName} version`, {cwd: target}),
    ).to.equal('1.0.0\n')
  })
})

/**
 *
 * @param {string} template
 * @param {string} registry
 * @returns {Promise<{target: string, packageName: string}>}
 */
async function createPackage(template, registry) {
  const target = await makeTemporaryDirectory()
  const packageName = path.basename(target)

  await sh(`${path.resolve(__dirname, '../../src/create-package.js')} ${template}`, {cwd: target})

  await writeFile('.npmrc', `registry=${registry}`, {cwd: target})

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
