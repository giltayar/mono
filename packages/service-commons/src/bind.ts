export type ServiceFunction<ServiceData, TArgs extends unknown[], TReturn> = (
  _service: ServiceData,
  ..._args: TArgs
) => TReturn

export function bind<ServiceData, TArgs extends unknown[], TReturn>(
  fn: ServiceFunction<ServiceData, TArgs, TReturn>,
  service: ServiceData,
) {
  return fn.bind(service, service) as (..._args: TArgs) => TReturn
}
