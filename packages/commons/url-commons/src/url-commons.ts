import assert from 'assert'

export function addQueryParamToUrl(url: URL, queryParam: string, value: string): URL {
  const ret = new URL(url)

  ret.searchParams.set(queryParam, value)

  return ret
}

export function addQueryParamsToUrl(url: URL, params: Record<string, string | undefined>): URL {
  const ret = new URL(url)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      ret.searchParams.set(key, value)
    }
  })

  return ret
}

export function addPathParamToPathSegment(
  pathSegment: string,
  pathParam: string,
  value: string | undefined,
): string {
  const pathParams = parsePathSegment(pathSegment)

  pathParams[pathParam] = value

  return buildPathSegmentFromPathParams(pathParams)
}

export function parsePathSegment(pathSegment: string): Record<string, string | undefined> {
  const ret: Record<string, string> = Object.create(null)

  if (pathSegment === '') {
    return ret
  }

  pathSegment.split('&').forEach((param) => {
    const [name, value, ...rest] = param.split('=')

    assert(
      name !== '__proto__',
      `someone is trying to hack us via proto poisoning with path segment ${pathSegment}`,
    )

    ret[name] = rest.length > 0 ? [value, ...rest].join('=') : value
  })

  return ret
}

export function buildPathSegmentFromPathParams(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .map(([name, value]) => {
      assert(
        !name.includes('&') && !name.includes('='),
        '"pathParam must not include parth param separators "&" and "="',
      )
      assert(!value || !value.includes('&'), '"value must not include parth param separator "="')

      return `${name}${value == null ? '' : '='}${value == null ? '' : value}`
    })
    .join('&')
}
