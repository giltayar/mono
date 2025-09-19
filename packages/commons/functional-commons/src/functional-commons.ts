export function memo<P extends any[], T>(
  syncCreationFunction: (...args: P) => T,
): (...args: P) => T {
  const cacheMap = new Map<string, T>()

  return (...args: P) => {
    const key = JSON.stringify(args)

    const cachedValue = cacheMap.get(key)
    if (cachedValue) {
      return cachedValue
    }
    const newValue = syncCreationFunction(...args)
    if (typeof (newValue as any)?.then === 'function')
      throw new Error('your function returned a promise. Maybe you want to use cacheFunctionAsync?')

    cacheMap.set(key, newValue)

    return newValue
  }
}

export function memoAsync<P extends any[], T>(
  asyncCreationFunction: (...args: P) => PromiseLike<T>,
  {
    expireAfterMs = undefined,
    nowService = Date.now,
  }: {expireAfterMs?: number; nowService?: () => number} = {},
): (...args: P) => PromiseLike<T> {
  const cacheMap = new Map<string, {value: T; creationTime: number}>()

  return async (...args: P) => {
    const key = JSON.stringify(args)

    const cachedValue = cacheMap.get(key)
    if (cachedValue) {
      const {value, creationTime} = cachedValue

      if (expireAfterMs === undefined || nowService() < creationTime + expireAfterMs) {
        return value
      }
    }
    const newValue = await asyncCreationFunction(...args)

    cacheMap.set(key, {value: newValue as T, creationTime: nowService()})

    return newValue as PromiseLike<T>
  }
}

export function range(from: number, to: number, step = 1): number[] {
  if (from >= to) return []

  return Array(Math.ceil((to - from) / step))
    .fill(0)
    .map((_, i) => i * step + from)
}

export function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0)
}

export function throw_(err: Error): never {
  throw err
}

type ObjectKeyType = string | number | symbol

export function group<T, K extends keyof T>(prop: K, list: T[]): Record<K, T[]> {
  return list.reduce(function (grouped: any, item: any) {
    const key = item[prop]

    grouped[key] = grouped[key] || []
    grouped[key].push(item)

    return grouped
  }, {}) as Record<K, T[]>
}

export function mapObject<K extends ObjectKeyType, L extends ObjectKeyType, T, W>(
  object: Record<K, T>,
  mapFunction: (k: K, t: T) => [L, W],
): Record<L, W> {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => mapFunction(key as unknown as K, value as T)),
  ) as Record<L, W>
}

export async function mapObjectAsync<T, U>(
  object: Record<string, T>,
  mapFunction: (key: string, value: T) => Promise<[string, U]>,
): Promise<Record<string, U>> {
  const entries = await Promise.all(
    Object.entries(object).map(([key, value]) => mapFunction(key, value)),
  )
  return Object.fromEntries(entries)
}

export function mapValues<K extends ObjectKeyType, T, W>(
  object: Record<K, T>,
  mapFunction: (t: T) => W,
): Record<K, W> {
  return mapObject(object, (key, value) => [key as unknown as K, mapFunction(value)]) as Record<
    K,
    W
  >
}

export function mapKeys<K extends ObjectKeyType, T, L extends ObjectKeyType>(
  object: Record<K, T>,
  mapFunction: (k: K) => L,
): Record<L, T> {
  return mapObject(object, (key, value) => [mapFunction(key as unknown as K), value])
}

export function filterKeys<K extends ObjectKeyType, T>(
  object: Record<K, T>,
  filterFunc: (k: K) => boolean,
): Record<K, T> {
  const ret = {} as Record<K, T>

  for (const [k, v] of Object.entries(object) as [K, T][]) {
    if (filterFunc(k)) {
      ret[k] = v
    }
  }

  return ret
}

export function filterValues<K extends ObjectKeyType, T>(
  object: Record<K, T>,
  filterFunc: (t: T) => boolean,
): Record<K, T> {
  const ret = {} as Record<K, T>

  for (const [k, v] of Object.entries(object) as [K, T][]) {
    if (filterFunc(v)) {
      ret[k] = v
    }
  }

  return ret
}

export function filterEntries<K extends ObjectKeyType, T>(
  object: Record<K, T>,
  filterFunc: (k: K, t: T) => boolean,
): Record<K, T> {
  const ret = {} as Record<K, T>

  for (const [k, v] of Object.entries(object) as [K, T][]) {
    if (filterFunc(k, v)) {
      ret[k] = v
    }
  }

  return ret
}

export function makeError<P extends Record<any, any>>(
  error: Error | string,
  properties?: P,
): P & Error {
  if (typeof error === 'string') {
    error = new Error(error)
  }
  if (!properties) return error as P & Error

  return Object.assign(error, properties)
}

export function zip<T1, T2>(l: T1[], r: T2[]): [T1 | undefined, T2 | undefined][] {
  const maxLength = [l, r].reduce(
    (maxTillNow, array) => (array.length > maxTillNow ? array.length : maxTillNow),
    0,
  )

  const zipResult: [T1 | undefined, T2 | undefined][] = []

  for (const i of range(0, maxLength)) {
    zipResult.push([l[i], r[i]])
  }

  return zipResult
}

export function minus<T>(
  bigArray: T[] = [],
  smallArray: T[] = [],
  keyMapper: (t: T) => T = (x) => x,
): T[] {
  return bigArray.filter((item) => !smallArray.map(keyMapper).includes(keyMapper(item)))
}

export function diff<T>(left: T[] = [], right: T[] = [], keyMapper: (t: T) => T = (x) => x): T[] {
  const intersection = left.filter((item) => right.map(keyMapper).includes(keyMapper(item)))
  return minus(left.concat(right), intersection, keyMapper)
}

export function pick<T extends object, K extends keyof T>(
  object: T | undefined | null,
  objectKeys: K[],
): Pick<T, K> | undefined | null {
  if (object === undefined) return undefined
  if (object === null) return null

  const ret = {} as Pick<T, K>

  for (const key of objectKeys) {
    if (!(key in object)) continue

    ret[key] = object[key]
  }

  return ret
}

export function clone<T>(value: T): T {
  if (typeof value === 'object') {
    if (value == null) {
      return value
    } else if (Array.isArray(value)) {
      if ((value as any).length === 0) {
        return value
      } else {
        return (value as any).map(clone) as unknown as T
      }
    } else if ((value as any).constructor?.name === 'Date') {
      return new Date((value as any).getTime()) as unknown as T
    } else {
      const ret = Object.create(Object.getPrototypeOf(value))

      for (const key in value as any) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          ;(ret as any)[key] = clone((value as any)[key])
        }
      }

      return ret
    }
  } else {
    return value
  }
}

export function sresult<T>(
  f: () => T,
): [error: Error, result: undefined] | [error: undefined, result: T] {
  try {
    return [undefined, f()]
  } catch (error) {
    return [error as Error, undefined]
  }
}
