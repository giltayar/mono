export function generateItemTitle(id: number | string | undefined, name: string | undefined) {
  if (!name) {
    return id == '0' ? '' : (id?.toString() ?? '')
  } else {
    return `${id}: ${name}`
  }
}
