/**
 * @template {any[]} P, T
 * @param {(...args: P) => T} syncCreationFunction
 * @returns {(...args: P) => T}
 */
export function memo(syncCreationFunction) {
  /**@type {Map<string, T>} */
  const cacheMap = new Map()

  return (...args) => {
    const key = JSON.stringify(args)

    const cachedValue = cacheMap.get(key)
    if (cachedValue) {
      return cachedValue
    }
    const newValue = syncCreationFunction(...args)
    if (typeof (/**@type {any}*/ (newValue).then) === 'function')
      throw new Error('your function returned a promise. Maybe you want to use cacheFunctionAsync?')

    cacheMap.set(key, newValue)

    return newValue
  }
}

/**
 * @template {any[]} P, T
 * @param {(...args: P) => PromiseLike<T>} asyncCreationFunction
 * @param {{expireAfterMs?: number, nowService?: () => number}} options
 *
 * @returns {(...args: P) => PromiseLike<T>}
 */
export function memoAsync(
  asyncCreationFunction,
  {expireAfterMs = undefined, nowService = Date.now} = {},
) {
  /**@type {Map<string, {value: T, creationTime: number}>} */
  const cacheMap = new Map()

  return async (...args) => {
    const key = JSON.stringify(args)

    const cachedValue = cacheMap.get(key)
    if (cachedValue) {
      const {value, creationTime} = cachedValue

      if (expireAfterMs === undefined || nowService() < creationTime + expireAfterMs) {
        return value
      }
    }
    const newValue = await asyncCreationFunction(...args)

    cacheMap.set(key, {value: newValue, creationTime: nowService()})

    return newValue
  }
}

/**
 * @param {number} from
 * @param {number} to
 * @param {number} [step]
 *
 * @returns {number[]}
 */
export function range(from, to, step = 1) {
  if (from >= to) return []

  return Array(Math.ceil((to - from) / step))
    .fill(0)
    .map((_, i) => i * step + from)
}

/**
 *
 * @param {number[]} numbers
 * @returns {number}
 */
export function sum(numbers) {
  return numbers.reduce((a, b) => a + b, 0)
}

/**
 *
 * @param {Error} err
 * @returns {void}
 */
export function throw_(err) {
  throw err
}
/**
 * @typedef {string|number|symbol} ObjectKeyType
 */

/**
 * @template T
 * @template {keyof T} K
 * @param {K} prop
 * @param {T[]} list
 * @returns {Record<K, T[]>}
 */
export function group(prop, list) {
  //@ts-expect-error
  return list.reduce(function (grouped, item) {
    const key = item[prop]

    //@ts-expect-error
    grouped[key] = grouped[key] || []
    //@ts-expect-error
    grouped[key].push(item)

    return grouped
  }, {})
}

/**
 * @template {ObjectKeyType} K
 * @template {ObjectKeyType} L
 * @template T
 * @template W
 * @param {Record<K, T>} object
 * @param {(k: K, t: T) => [L, W]} mapFunction
 *
 * @returns {Record<L, W>}
 */
export function mapObject(object, mapFunction) {
  //@ts-expect-error
  return Object.fromEntries(Object.entries(object).map(([key, value]) => mapFunction(key, value)))
}

/**
 * @template {ObjectKeyType} K
 * @template T
 * @template W
 * @param {Record<K, T>} object
 * @param {(t: T) => W} mapFunction
 *
 * @returns {Record<K, W>}
 */
export function mapValues(object, mapFunction) {
  return mapObject(object, (key, value) => [key, mapFunction(value)])
}

/**
 * @template {ObjectKeyType} K
 * @template T
 * @template {ObjectKeyType} L
 * @param {Record<K, T>} object
 * @param {(k: K) => L} mapFunction
 *
 * @returns {Record<L, T>}
 */
export function mapKeys(object, mapFunction) {
  return mapObject(object, (key, value) => [mapFunction(key), value])
}

/**
 * @template {ObjectKeyType} K
 * @template T
 * @param {Record<K, T>} object
 * @param {(k: K) => boolean} filterFunc
 *
 * @returns {Record<K, T>}
 */
export function filterKeys(object, filterFunc) {
  const ret = /**@type{Record<K, T>}*/ ({})

  for (const [k, v] of /**@type{[k: K, t: T][]}*/ (Object.entries(object))) {
    if (filterFunc(k)) {
      ret[k] = v
    }
  }

  return ret
}

/**
 * @template {ObjectKeyType} K
 * @template T
 * @param {Record<K, T>} object
 * @param {(t: T) => boolean} filterFunc
 *
 * @returns {Record<K, T>}
 */
export function filterValues(object, filterFunc) {
  const ret = /**@type{Record<K, T>}*/ ({})

  for (const [k, v] of /**@type{[k: K, t: T][]}*/ (Object.entries(object))) {
    if (filterFunc(v)) {
      ret[k] = v
    }
  }

  return ret
}

/**
 * @template {ObjectKeyType} K
 * @template T
 * @param {Record<K, T>} object
 * @param {(k: K, t: T) => boolean} filterFunc
 *
 * @returns {Record<K, T>}
 */
export function filterEntries(object, filterFunc) {
  const ret = /**@type{Record<K, T>}*/ ({})

  for (const [k, v] of /**@type{[k: K, t: T][]}*/ (Object.entries(object))) {
    if (filterFunc(k, v)) {
      ret[k] = v
    }
  }

  return ret
}

/**
 * @template {ObjectKeyType} K, T
 * @template {Record<K, T>} P
 * @param {Error|string} error
 * @param {P} [properties]
 *
 * @returns {P & Error}
 */
export function makeError(error, properties = undefined) {
  if (typeof error === 'string') {
    error = new Error(error)
  }
  // @ts-expect-error
  if (!properties) return error

  return Object.assign(error, properties)
}

/**
 * @template T1, T2
 * @param  {T1[]} l
 * @param  {T2[]} r
 * @returns {[T1, T2][]}
 */
export function zip(l, r) {
  const maxLength = [l, r].reduce(
    (maxTillNow, array) => (array.length > maxTillNow ? array.length : maxTillNow),
    0,
  )

  const zipResult = /**@type{[T1, T2][]}*/ ([])

  for (const i of range(0, maxLength)) {
    zipResult.push([l[i], r[i]])
  }

  return zipResult
}

/**
 * @template T
 * @param {T[]} bigArray
 * @param {T[]} smallArray
 * @param {(t: T) => T} keyMapper
 */
export function minus(bigArray = [], smallArray = [], keyMapper = (x) => x) {
  return bigArray.filter((item) => !smallArray.map(keyMapper).includes(keyMapper(item)))
}

/**
 * @template T
 * @param {T[]} left
 * @param {T[]} right
 * @param {(t: T) => T} keyMapper
 */
export function diff(left = [], right = [], keyMapper = (x) => x) {
  const intersection = left.filter((item) => right.map(keyMapper).includes(keyMapper(item)))
  return minus(left.concat(right), intersection, keyMapper)
}

/**
 * @template {object} T
 * @template {keyof T} K
 * @param {T|undefined} object
 * @param {K[]} objectKeys
 *
 * @returns {Pick<T, K> | undefined | null}
 */
export function pick(object, objectKeys) {
  if (object === undefined) return undefined
  if (object === null) return null

  const ret = /**@type{Pick<T, K>}*/ ({})

  for (const key of objectKeys) {
    if (!(key in object)) continue

    ret[key] = object[key]
  }

  return ret
}
