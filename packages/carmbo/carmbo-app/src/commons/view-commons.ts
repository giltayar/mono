export function generateItemTitle(id: number | string, name: string | undefined) {
  if (!name) {
    return id.toString()
  } else {
    return `${id}: ${name}`
  }
}
