import {captureConsole, consoleOutputAsString, uncaptureConsole} from '@seasquared/console-tesktit'
import {makeTemporaryDirectory} from '@seasquared/scripting-commons'
import chai from 'chai'
import chaiFs from 'chai-fs'
import mocha from 'mocha'
import path from 'path'
import {app} from '../../src/kdeploy.js'
const {describe, it} = mocha
const {expect, use} = chai
use(chaiFs)

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('kdeploy it', function () {
  it('should show help', async () => {
    const consoleCapturer = captureConsole()
    await app(['--help'], {shouldExitOnError: false})

    expect(consoleOutputAsString({consoleCapturer}))
      .to.include('--version')
      .and.include('Show version number')
      .and.include('--help')
      .and.include('Show help')

    uncaptureConsole({consoleCapturer})
  })

  it('should generate correct yaml from handlebar templates', async () => {
    const output = await makeTemporaryDirectory()
    await app([
      'generate-yaml',
      '--name=hello',
      '--input',
      path.resolve(__dirname, 'fixtures/simple-template'),
      '--output',
      output,
    ])

    expect(output).to.be.a.directory().with.deep.files(['template1.yaml', 'template2.yaml'])
    expect(path.join(output, 'template1.yaml'))
      .to.be.a.file()
      .with.content('key: this text should appear there hello 1')
    expect(path.join(output, 'template2.yaml'))
      .to.be.a.file()
      .with.content('key: this text should appear there hello 2')
  })

  it('should work with overrides', async () => {
    const output = await makeTemporaryDirectory()
    await app([
      'generate-yaml',
      '--name=hello',
      '--input',
      path.resolve(__dirname, 'fixtures/overrides'),
      '--output',
      output,
      '--override=name=something-else',
      '--override=foo=bar',
    ])

    expect(output).to.be.a.directory().with.deep.files(['template.yaml'])
    expect(path.join(output, 'template.yaml'))
      .to.be.a.file()
      .with.content('key: name is something-else and foo is bar')
  })

  it('should work with value files', async () => {
    const output = await makeTemporaryDirectory()
    await app([
      'generate-yaml',
      '--name=hello',
      '--cluster=a-cluster',
      '--input',
      path.resolve(__dirname, 'fixtures/values'),
      '--package=a-package',
      '--values=more-values.yaml',
      '--output',
      output,
    ])

    expect(output).to.be.a.directory().with.deep.files(['template.yaml'])
    expect(path.join(output, 'template.yaml')).to.be.a.file().with.content(
      `
aPackageAClusterValue: aPackageAClusterValueV
aPackageValue: aPackageValueV
aPackageValueToOverride: aPackageValueToOverrideOverriden
anotherPackageValueToOverride: anotherPackageValueToOverrideOverriden
aClusterValue: aClusterValueV
aClusterValueToOverride: aClusterValueToOverrideOverriden
aClusterValueToNotOverride: anotherClusterValueToOverrideV
valuesValue: valuesValueV
valuesValueToOverride: valuesValueToOverrideOverriden
moreValuesValue: moreValuesValueV
moreValuesValueNotToOverride: moreValuesValueNotToOverrideV
    `.trim(),
    )
  })

  it('should work with folder packages', async () => {
    const output = await makeTemporaryDirectory()
    await app([
      'generate-yaml',
      '--name=hello',
      '--cluster=a-cluster',
      '--package=./deploy/variation-0',
      '--input',
      path.resolve(__dirname, 'fixtures/folder-packages'),
      '--output',
      output,
    ])

    expect(output).to.be.a.directory().with.deep.files(['template.yaml'])
    expect(path.join(output, 'template.yaml'))
      .to.be.a.file()
      .with.content(`aValue: valueFromValuesYaml`)
  })

  it('should support partials', async () => {
    const output = await makeTemporaryDirectory()
    await app([
      'generate-yaml',
      '--name=hello',
      '--cluster=a-cluster',
      '--input',
      path.resolve(__dirname, 'fixtures/partials'),
      '--package=a-package',
      '--output',
      output,
    ])

    expect(output).to.be.a.directory().with.deep.files(['template.yaml'])
    expect(path.join(output, 'template.yaml')).to.be.a.file().with.content(
      `
clusterPartials: aPackageValueV!
More:
  partial: yes!
packagePartials: aPackageValueV!
morePackageValues: yes!
    `.trim(),
    )
  })
})
