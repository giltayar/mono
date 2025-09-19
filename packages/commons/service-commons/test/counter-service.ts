import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

namespace CounterService {
  export interface Context {
    delta: number
  }
}

interface State {
  counter: number
}

type ServiceData = {
  context: CounterService.Context
  state: State
}

export function createCounterService(context: CounterService.Context) {
  const state = {counter: 0}

  const sBind: ServiceBind<ServiceData> = (f) => bind(f, {context, state})

  return {
    increment: sBind(increment),
    decrement: sBind(decrement),
    counter: sBind((s) => s.state.counter),
  }
}

function increment(s: ServiceData, arg1: string, arg2: number) {
  s.state.counter += s.context.delta

  return `arg1: ${arg1}, context: ${JSON.stringify(s.context)}, arg2: ${arg2}`
}

function decrement(s: ServiceData) {
  s.state.counter -= s.context.delta

  return `args: ${1}, context: ${JSON.stringify(s.context)}`
}
