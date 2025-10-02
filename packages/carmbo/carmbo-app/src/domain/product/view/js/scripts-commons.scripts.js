/**
 * @param {number | string} id
 * @param {string | undefined} name
 *
 * @returns {string}
 */
export function generateItemTitle(id, name) {
  if (!name) {
    return id.toString()
  } else {
    return `${id}: ${name}`
  }
}
