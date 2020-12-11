import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
import chaiSubset from 'chai-subset'
const {expect, use} = chai
use(chaiSubset)

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

import {getDependencyInformation} from '../../src/dependencies-commons.js'
import path from 'path'

describe('dependencies-commons (integ)', function () {
  const dependenciesInFixtures = {
    debug: {
      cleanName: 'debug',
      envName: 'DEBUG_VERSION',
      version: '10.11.12',
    },
    express: {
      cleanName: 'express',
      envName: 'EXPRESS_VERSION',
      version: /**@param {string} v*/ (v) => v.includes('unknown version because package.json'),
    },
    redis: {
      cleanName: 'redis',
      envName: 'REDIS_VERSION',
      version: /**@param {string} v*/ (v) => v.includes('unknown version because package.json'),
    },
    '@scoped/semver': {
      cleanName: 'scoped_semver',
      envName: 'SCOPED_SEMVER_VERSION',
      version: '1.2.3',
    },
    semver: {
      cleanName: 'semver',
      envName: 'SEMVER_VERSION',
      version: '1.2.3',
    },
  }

  it('should find the depdencies for a and get the information', () => {
    expect(
      getDependencyInformation(path.join(__dirname, 'fixtures/package/abc/def/foo.txt')),
    ).to.containSubset(dependenciesInFixtures)
  })

  it('should find the depdencies for a dir and get the information', () => {
    expect(
      getDependencyInformation(path.join(__dirname, 'fixtures/package/abc/')),
    ).to.containSubset(dependenciesInFixtures)
  })

  it('should find the depdencies for a and get the information', () => {
    expect(
      getDependencyInformation(path.join(__dirname, 'fixtures/package/abc/def/foo.txt')),
    ).to.containSubset(dependenciesInFixtures)
  })

  it('should find the depdencies for the same dir and get the information', () => {
    expect(getDependencyInformation(path.join(__dirname, 'fixtures/package'))).to.containSubset(
      dependenciesInFixtures,
    )
  })

  it('should find the depdencies for a file in the same dir and get the information', () => {
    expect(
      getDependencyInformation(path.join(__dirname, 'fixtures/package/foo.txt')),
    ).to.containSubset(dependenciesInFixtures)
  })

  it('should fail if package.json is bad', () => {
    expect(() => getDependencyInformation(path.join(__dirname, 'fixtures/bad-package'))).to.throw(
      /not JSON-parseable/,
    )
  })
})
