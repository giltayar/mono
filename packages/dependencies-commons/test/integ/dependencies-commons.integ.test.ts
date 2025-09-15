import assert from 'node:assert'
import {describe, it} from 'node:test'

import {getDependencyInformation} from '../../src/dependencies-commons.ts'

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
      version: (v: string) => v.includes('unknown version because package.json'),
    },
    redis: {
      cleanName: 'redis',
      envName: 'REDIS_VERSION',
      version: (v: string) => v.includes('unknown version because package.json'),
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
    const got = getDependencyInformation(
      new URL('fixtures/package/abc/def/foo.txt', import.meta.url),
    )
    for (const k of Object.keys(dependenciesInFixtures)) {
      const expected = (dependenciesInFixtures as any)[k]
      const actual = (got as any)[k]
      assert.ok(actual)
      assert.strictEqual(actual.cleanName, expected.cleanName)
      assert.strictEqual(actual.envName, expected.envName)
      if (typeof expected.version === 'string') {
        assert.strictEqual(actual.version, expected.version)
      } else {
        assert.ok(expected.version(actual.version))
      }
    }
  })

  it('should find the depdencies for a dir and get the information', () => {
    const got = getDependencyInformation(new URL('fixtures/package/abc/', import.meta.url))
    for (const k of Object.keys(dependenciesInFixtures)) {
      const actual = (got as any)[k]
      assert.ok(actual)
    }
  })

  it('should find the depdencies for a and get the information', () => {
    const got = getDependencyInformation(
      new URL('fixtures/package/abc/def/foo.txt', import.meta.url),
    )
    for (const k of Object.keys(dependenciesInFixtures)) {
      assert.ok((got as any)[k])
    }
  })

  it('should find the depdencies for the same dir and get the information', () => {
    const got = getDependencyInformation(new URL('fixtures/package', import.meta.url))
    for (const k of Object.keys(dependenciesInFixtures)) {
      assert.ok((got as any)[k])
    }
  })

  it('should find the depdencies for a file in the same dir and get the information', () => {
    const got = getDependencyInformation(new URL('fixtures/package/foo.txt', import.meta.url))
    for (const k of Object.keys(dependenciesInFixtures)) {
      assert.ok((got as any)[k])
    }
  })

  it('should fail if package.json is bad', () => {
    let threw = false
    try {
      getDependencyInformation(new URL('fixtures/bad-package', import.meta.url))
    } catch (err: any) {
      threw = true
      assert.match(err.message, /not JSON-parseable/)
    }
    assert.ok(threw)
  })
})
