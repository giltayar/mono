import fs from 'fs'

export let uiConfiguration: {name: string; logoFile: string}

export function setUiConfiguration(configurationName: string) {
  uiConfiguration = {
    name: configurationName,
    logoFile: determineLogoFile(`src/layout/style/configurations/${configurationName}`),
  }
}

function determineLogoFile(basePath: string) {
  const possibleExtensions = ['svg', 'png']
  for (const ext of possibleExtensions) {
    const logoFile = `logo.${ext}`
    const path = `${basePath}/${logoFile}`

    if (fs.existsSync(new URL(`../../${path}`, import.meta.url))) {
      return logoFile
    }
  }
  throw new Error(
    `No valid logo file found for configuration at ${basePath} with extensions ${possibleExtensions.join(', ')}`,
  )
}
