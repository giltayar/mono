import {setTimeout as setTimeoutAsync} from 'node:timers/promises'

export async function failAfter(ms: number, errFactory: () => unknown): Promise<void> {
  await delay(ms)
  throw errFactory()
}

export function presult<T, TErr>(promise: Promise<T>): Promise<[TErr, undefined] | [undefined, T]> {
  return promise.then(
    (v) => [undefined, v] as [undefined, T],
    (err) => [err, undefined] as [TErr, undefined],
  )
}

export function unwrapPresult<T, TErr>(
  presultPromise: Promise<[TErr, undefined] | [undefined, T]>,
): Promise<T> {
  const ret = presultPromise.then(([err, v]) =>
    err != null ? Promise.reject(err) : (v as NonNullable<T>),
  )
  return ret
}

export function delay(ms: number): Promise<void> {
  return setTimeoutAsync(ms)
}

export function ptimeoutWithValue<T, V>(
  promiseOrPromiseFunc: Promise<T> | ((abortSignal: AbortSignal) => Promise<T>),
  timeout: number,
  value: V,
): Promise<T | V> {
  return ptimeoutWithFunction(promiseOrPromiseFunc, timeout, () => Promise.resolve(value))
}

export function ptimeoutWithError<T, TErr>(
  promiseOrPromiseFunc: Promise<T> | ((abortSignal: AbortSignal) => Promise<T>),
  timeout: number,
  error: TErr,
): Promise<T | never> {
  return ptimeoutWithFunction(promiseOrPromiseFunc, timeout, () => Promise.reject(error))
}

export async function ptimeoutWithFunction<T, V>(
  promiseOrPromiseFunc: Promise<T> | ((abortSignal: AbortSignal) => Promise<T>),
  timeout: number,
  func: () => Promise<V>,
): Promise<T | V> {
  const abortController = new AbortController()

  const promise =
    typeof promiseOrPromiseFunc === 'function'
      ? (promiseOrPromiseFunc as (signal: AbortSignal) => Promise<T>)(abortController.signal)
      : (promiseOrPromiseFunc as Promise<T>)

  let cancel: ReturnType<typeof setTimeout> | undefined
  const v = await Promise.race([
    (promise as Promise<T>).then(
      (v) => {
        abortController.abort()
        if (cancel) clearTimeout(cancel)
        cancel = undefined
        return v
      },
      (err) => {
        abortController.abort()
        if (cancel) clearTimeout(cancel)
        cancel = undefined
        return Promise.reject(err)
      },
    ),
    new Promise(
      (res) =>
        (cancel = setTimeout(() => {
          if (!cancel) res(undefined)
          else {
            cancel = undefined
            abortController.abort()
            res(func())
          }
        }, timeout)),
    ),
  ])

  return v as T | V
}
