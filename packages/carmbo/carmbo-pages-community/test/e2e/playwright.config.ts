import {defineConfig} from '@playwright/test'
import {existsSync} from 'node:fs'
import {loadEnvFile} from 'node:process'

const localEnv = new URL('../../.env.local', import.meta.url)
if (existsSync(localEnv)) loadEnvFile(localEnv)

export default defineConfig({
  testDir: '.',
  outputDir: './.test-results',
  preserveOutput: 'failures-only',
  timeout: 30000,
  retries: 0,
  workers: 1,
})
