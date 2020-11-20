import mocha from 'mocha'
const {
  before: mochaBefore,
  beforeEach: mochaBeforeEach,
  describe: mochaDescribe,
  it: mochaIt,
  after: mochaAfter,
  afterEach: mochaAfterEach,
} = mocha

/**
 * @template T
 * @typedef Functionify
 * @type {{ [K in keyof T]: () => T[K] }}
 */

/**
 * @template T
 * @param {(f: Parameters<import('mocha').Func>) => T} f
 * @returns {T extends Promise<any> ? Functionify<import('type-fest').PromiseValue<T>> : Functionify<T>}
 */
export function before(f) {
  /**@type {T|undefined} */
  let returnValueFromF = undefined

  mochaBefore(() => {
    //@ts-expect-error
    returnValueFromF = f()

    // @ts-expect-error
    if (returnValueFromF.then) {
      // @ts-expect-error
      return f().then((v) => {
        returnValueFromF = v
        return Promise.resolve(v)
      })
    } else {
      return returnValueFromF
    }
  })

  return /**@type {T extends Promise<any> ? Functionify<import('type-fest').PromiseValue<T>> : Functionify<T>}*/ (new Proxy(
    {},
    {
      get: function (_object, propertyName) {
        return () => {
          if (returnValueFromF != null) {
            //@ts-expect-error
            return returnValueFromF[propertyName]
          } else {
            throw new Error(
              `trying to access property ${String(propertyName)} before the "before happened`,
            )
          }
        }
      },
    },
  ))
}

/**
 * @template T
 * @param {(f: Parameters<import('mocha').Func>) => T} f
 * @returns {T extends Promise<any> ? Functionify<import('type-fest').PromiseValue<T>> : Functionify<T>}
 */
export function beforeEach(f) {
  /**@type {T|undefined} */
  let returnValueFromF = undefined

  mochaBeforeEach(() => {
    //@ts-expect-error
    returnValueFromF = f()

    // @ts-expect-error
    if (returnValueFromF.then) {
      // @ts-expect-error
      return f().then((v) => {
        returnValueFromF = v
        return Promise.resolve(v)
      })
    } else {
      return returnValueFromF
    }
  })

  return /**@type {T extends Promise<any> ? Functionify<import('type-fest').PromiseValue<T>> : Functionify<T>}*/ (new Proxy(
    {},
    {
      get: function (_object, propertyName) {
        return () => {
          if (returnValueFromF != null) {
            //@ts-expect-error
            return returnValueFromF[propertyName]
          } else {
            throw new Error(
              `trying to access property ${String(propertyName)} before the "before happened`,
            )
          }
        }
      },
    },
  ))
}

export const describe = mochaDescribe
export const it = mochaIt
export const after = mochaAfter
export const afterEach = mochaAfterEach
