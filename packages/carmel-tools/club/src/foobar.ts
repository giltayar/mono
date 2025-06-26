namespace FoorBarService {
  export interface Context {
    x: number
    y: number
  }
}

interface State {
  counter: number
}

type ServiceData = {
  context: FoorBarService.Context
  state: State
}

type ServiceFunction<ServiceData, TArgs extends any[], TReturn> = (
  service: ServiceData,
  ...args: TArgs
) => TReturn

function bind<ServiceData, TArgs extends any[], TReturn>(
  fn: ServiceFunction<ServiceData, TArgs, TReturn>,
  service: ServiceData,
): (...args: TArgs) => TReturn {
  return fn.bind(service, service) as (...args: TArgs) => TReturn
}

function createFooBarService(context: FoorBarService.Context) {
  const state = {counter: 1}

  const sBind = <TArgs extends any[], TReturn>(f: ServiceFunction<ServiceData, TArgs, TReturn>) =>
    bind(f, {context, state})

  return {
    increment: sBind(increment),
    decrement: sBind(decrement),
  }
}

function increment(s: ServiceData, arg1: string, arg2: number) {
  s.state.counter++

  console.log(
    'FooBarService.increment called with:',
    arg1,
    'and context:',
    s.context,
    'counter is now:',
    s.state.counter,
  )

  return s.state.counter
}

function decrement(service: ServiceData, a: string[], b: boolean) {}

const s = createFooBarService({x: 1, y: 2})

console.log(s.increment('test', 42))
s.increment('test2', 43)
s.decrement(['test'], true)
