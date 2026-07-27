import fs from 'node:fs'
import process from 'node:process'

const ENV_FILE = new URL('../../.env.local', import.meta.url)

export function loadEnvFile(): void {
  if (fs.existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE)
  }
}
