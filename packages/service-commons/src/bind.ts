export type ServiceFunction<ServiceData, TArgs extends unknown[], TReturn> = (
  service: ServiceData,
  ...args: TArgs
) => TReturn

export function bind<ServiceData, TArgs extends unknown[], TReturn>(
  fn: ServiceFunction<ServiceData, TArgs, TReturn>,
  service: ServiceData,
) {
  return fn.bind(service, service) as (...args: TArgs) => TReturn
}

export type ServiceBind<ServiceData> = <TArgs extends unknown[], TReturn>(
  f: ServiceFunction<ServiceData, TArgs, TReturn>,
) => (...args: TArgs) => TReturn
