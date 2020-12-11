/**
 *
 * @param {string} packageName
 * @returns {string}
 */
export function cleanName(packageName) {
  return packageName.replaceAll('@', '').replaceAll('/', '_').replaceAll('-', '_')
}
/**
 *
 * @param {string} packageName
 * @returns {string}
 */
export function envName(packageName) {
  return `${cleanName(packageName).toUpperCase()}_VERSION`
}
