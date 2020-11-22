import assert from 'assert'

/**
 *
 * @param {URL} url
 * @param {string} queryParam
 * @param {string} value
 *
 * @returns {URL}
 */
export function addQueryParamToUrl(url, queryParam, value) {
  url.searchParams.set(queryParam, value)

  return url
}

/**
 *
 * @param {string} pathSegment
 * @param {string} pathParam
 * @param {string|undefined} value
 *
 * @returns {string}
 */
export function addPathParamToPathSegment(pathSegment, pathParam, value) {
  const pathParams = parsePathSegment(pathSegment)

  pathParams[pathParam] = value

  return buildPathSegmentFromPathParams(pathParams)
}

/**
 *
 * @param {string} pathSegment
 * @returns {Record<string, string|undefined>}
 */
export function parsePathSegment(pathSegment) {
  /**@type {Record<string, string>} */
  const ret = Object.create(null)

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

/**
 *
 * @param {Record<string, string|undefined>} params
 *
 * @returns {string}
 */
export function buildPathSegmentFromPathParams(params) {
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
