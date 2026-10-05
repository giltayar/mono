let applicationVersion: string | undefined

export function setVersion(version: string): void {
  if (!version.trim()) {
    throw new Error('The application version must not be empty')
  }
  applicationVersion = version
}

export function getVersion(): string {
  if (applicationVersion === undefined) {
    throw new Error('Call setVersion with the application version before rendering')
  }
  return applicationVersion
}
