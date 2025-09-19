import {before as nodeBefore, beforeEach as nodeBeforeEach} from 'node:test'

export {describe, it, after, afterEach} from 'node:test'

export function before<T>(
  hookFn: (
    ...args: Parameters<NonNullable<Parameters<typeof nodeBefore>[0]>>
  ) => T | PromiseLike<T>,
): T extends PromiseLike<unknown> ? Valueify<Awaited<T>> : Valueify<T> {
  let returnValueFromF: T | PromiseLike<T> | undefined = undefined
  let finalReturnValue: T | undefined = undefined

  nodeBefore((...args) => {
    returnValueFromF = hookFn(...args)

    if (returnValueFromF && typeof returnValueFromF === 'object' && 'then' in returnValueFromF) {
      return returnValueFromF.then((v) => {
        finalReturnValue = v
      })
    } else {
      finalReturnValue = returnValueFromF
    }
  })

  return new Proxy(
    {},
    {
      get: function (_object, propertyName) {
        return {
          get value() {
            if (finalReturnValue && typeof finalReturnValue === 'object') {
              //@ts-expect-error the usual
              return finalReturnValue[propertyName]
            } else {
              throw new Error(
                `trying to access property ${String(propertyName)} before the "before" happened`,
              )
            }
          },
        }
      },
    },
  ) as T extends PromiseLike<unknown> ? Valueify<Awaited<T>> : Valueify<T>
}

export function beforeEach<T>(
  hookFn: (
    ...args: Parameters<NonNullable<Parameters<typeof nodeBefore>[0]>>
  ) => T | PromiseLike<T>,
): T extends PromiseLike<unknown> ? Valueify<Awaited<T>> : Valueify<T> {
  let returnValueFromF: T | PromiseLike<T> | undefined = undefined
  let finalReturnValue: T | undefined = undefined

  nodeBeforeEach((...args) => {
    returnValueFromF = hookFn(...args)

    if (returnValueFromF && typeof returnValueFromF === 'object' && 'then' in returnValueFromF) {
      return returnValueFromF.then((v) => {
        finalReturnValue = v
      })
    } else {
      finalReturnValue = returnValueFromF
    }
  })

  return new Proxy(
    {},
    {
      get: function (_object, propertyName) {
        return {
          get value() {
            if (finalReturnValue && typeof finalReturnValue === 'object') {
              //@ts-expect-error the usual
              return finalReturnValue[propertyName]
            } else {
              throw new Error(
                `trying to access property ${String(propertyName)} before the "beforeEach" happened`,
              )
            }
          },
        }
      },
    },
  ) as T extends PromiseLike<unknown> ? Valueify<Awaited<T>> : Valueify<T>
}

type Valueify<T> = {[K in keyof T]: {value: T[K]}}
