export function cleanName(packageName: string) {
  return packageName.replaceAll('@', '').replaceAll('/', '_').replaceAll('-', '_')
}

export function envName(packageName: string) {
  return `${cleanName(packageName).toUpperCase()}_VERSION`
}
