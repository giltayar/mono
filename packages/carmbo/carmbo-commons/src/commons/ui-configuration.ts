import fs from 'node:fs'
import {layoutStyleRoot} from '../layout/asset-roots.ts'

export let uiConfiguration: {name: string; logoFile: string; withCommunities: boolean}

export function setUiConfiguration(
  configurationName: string,
  {withCommunities}: {withCommunities: boolean},
): void {
  uiConfiguration = {
    name: configurationName,
    logoFile: determineLogoFile(`configurations/${configurationName}`),
    withCommunities: withCommunities,
  }
}

export function getUiConfiguration(): typeof uiConfiguration {
  if (!uiConfiguration) {
    throw new Error('Call setUiConfiguration before rendering navigation')
  }
  return uiConfiguration
}

function determineLogoFile(basePath: string) {
  const possibleExtensions = ['svg', 'png']
  for (const ext of possibleExtensions) {
    const logoFile = `logo.${ext}`
    const path = `${basePath}/${logoFile}`

    if (fs.existsSync(new URL(path, layoutStyleRoot))) {
      return logoFile
    }
  }
  throw new Error(
    `No valid logo file found for configuration at ${basePath} with extensions ${possibleExtensions.join(', ')}`,
  )
}
