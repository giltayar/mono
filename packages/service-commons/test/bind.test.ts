import {describe, it} from 'node:test'
import assert from 'node:assert'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

namespace FooBarService {
  export interface Context {
    x: number
    y: number
  }
}

interface State {
  counter: number
}

type ServiceData = {
  context: FooBarService.Context
  state: State
}

function createFooBarService(context: FooBarService.Context) {
  const state = {counter: 0}

  const sBind: ServiceBind<ServiceData> = (f) => bind(f, {context, state})

  return {
    increment: sBind(increment),
    decrement: sBind(decrement),
    counter: sBind((s) => s.state.counter),
  }
}

function increment(s: ServiceData, arg1: string, arg2: number) {
  s.state.counter++

  return `arg1: ${arg1}, context: ${JSON.stringify(s.context)}, arg2: ${arg2}`
}

function decrement(s: ServiceData) {
  s.state.counter--

  return `args: ${1}, context: ${JSON.stringify(s.context)}`
}

describe('FooBarService', () => {
  describe('state management', () => {
    it('should maintain state across multiple operations', () => {
      const service = createFooBarService({x: 1, y: 1})

      assert.strictEqual(service.increment('op1', 1), 'arg1: op1, context: {"x":1,"y":1}, arg2: 1')
      assert.strictEqual(service.counter(), 1)

      service.increment('op2', 2)
      assert.strictEqual(service.counter(), 2)

      assert.strictEqual(service.decrement(), 'args: 1, context: {"x":1,"y":1}')
      assert.strictEqual(service.counter(), 1)

      service.decrement()
      assert.strictEqual(service.counter(), 0)
    })

    it('should not share state between different service instances', () => {
      const service1 = createFooBarService({x: 1, y: 2})
      const service2 = createFooBarService({x: 3, y: 4})

      assert.strictEqual(
        service1.increment('test1', 1),
        'arg1: test1, context: {"x":1,"y":2}, arg2: 1',
      )
      assert.strictEqual(
        service2.increment('test2', 2),
        'arg1: test2, context: {"x":3,"y":4}, arg2: 2',
      )

      assert.strictEqual(service1.counter(), 1)
      assert.strictEqual(service2.counter(), 1)

      service1.increment('test3', 3)

      assert.strictEqual(service1.counter(), 2)
      assert.strictEqual(service2.counter(), 1)
    })
  })
})
