import {describe, it} from 'node:test'
import assert from 'node:assert'
import {createCounterService} from './counter-service.ts'

describe('bind', () => {
  it('should maintain state across multiple operations', () => {
    const service = createCounterService({delta: 2})

    assert.strictEqual(service.increment('op1', 1), 'arg1: op1, context: {"delta":2}, arg2: 1')
    assert.strictEqual(service.counter(), 2)

    service.increment('op2', 2)
    assert.strictEqual(service.counter(), 4)

    assert.strictEqual(service.decrement(), 'args: 1, context: {"delta":2}')
    assert.strictEqual(service.counter(), 2)

    service.decrement()
    assert.strictEqual(service.counter(), 0)
  })

  it('should not share state between different service instances', () => {
    const service1 = createCounterService({delta: 3})
    const service2 = createCounterService({delta: 1})

    assert.strictEqual(service1.increment('test1', 1), 'arg1: test1, context: {"delta":3}, arg2: 1')
    assert.strictEqual(service2.increment('test2', 2), 'arg1: test2, context: {"delta":1}, arg2: 2')

    assert.strictEqual(service1.counter(), 3)
    assert.strictEqual(service2.counter(), 1)

    service1.increment('test3', 3)

    assert.strictEqual(service1.counter(), 6)
    assert.strictEqual(service2.counter(), 1)
  })
})
