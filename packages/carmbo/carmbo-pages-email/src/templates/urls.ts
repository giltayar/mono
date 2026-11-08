export function isSafeUrl(value: string, image: boolean): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return (image ? ['https:', 'http:'] : ['https:', 'http:', 'mailto:', 'tel:']).includes(
      url.protocol,
    )
  } catch {
    return !image && value.startsWith('#')
  }
}

export function isTemplateUrl(value: string, image: boolean): boolean {
  if (!value.includes('{{')) return isSafeUrl(value, image)
  const scheme = value
    .trim()
    .match(/^([a-z][a-z0-9+.-]*:)/i)?.[1]
    .toLowerCase()
  return (
    scheme === undefined ||
    (image ? ['https:', 'http:'] : ['https:', 'http:', 'mailto:', 'tel:']).includes(scheme)
  )
}
