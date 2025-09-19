import {before, after, describe, it, afterEach, beforeEach} from '../../src/node-test-commons.ts'
import assert from 'node:assert/strict'

describe('node-test-commons (unit)', function () {
  let count = 0
  const {a, b} = before(() => ({
    a: 4,
    b: {z: 5},
    count: ++count,
  }))
  before(() => assert.equal(count, 1))
  before(() => undefined)
  beforeEach(() => undefined)
  const {c, d} = before(async () => ({
    c: 4,
    d: {z: 5},
    count: ++count,
  }))
  before(() => assert.equal(count, 2))

  let countAfter = 0
  let countAfterEach = 0

  after(() => {
    ++countAfter
  })

  afterEach(() => {
    ++countAfterEach
  })

  after(() => {
    assert.equal(countAfter, 1)
    assert.equal(countAfterEach, 2)
  })

  assert.throws(() => c.value, /trying to access property c/)

  it('should work with sync before', async () => {
    assert.equal(count, 2)
    assert.equal(a.value, 4)
    assert.equal(b.value.z, 5)
  })

  it('should work with async before', async () => {
    assert.equal(count, 2)
    assert.equal(c.value, 4)
    assert.equal(d.value.z, 5)
  })
})
