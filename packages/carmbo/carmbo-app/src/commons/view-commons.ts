export function generateItemTitle(id: number | string | undefined, name: string | undefined) {
  if (!name) {
    return id == '0' ? '' : (id?.toString() ?? '')
  } else {
    return `${id}: ${name}`
  }
}

export function When({
  cond,
  children,
}: {
  cond: unknown
  children: string | string[]
}): string | string[] {
  if (cond) {
    return children
  } else {
    return ''
  }
}
