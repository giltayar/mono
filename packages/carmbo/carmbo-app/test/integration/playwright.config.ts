import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: '.',
  outputDir: './.test-results',
  preserveOutput: 'failures-only',
  expect: {timeout: 5000},
  timeout: process.env.CI ? 10000 : 7000,
  retries: process.env.CI ? 3 : 0,
  workers: process.env.CI ? 2 : 4,
  use: {
    screenshot: 'only-on-failure',
  },
})
