import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: '.',
  outputDir: './.test-results',
  preserveOutput: 'failures-only',
  expect: {timeout: 2000},
  timeout: 7000,
  retries: process.env.CI ? 2 : 0,
  workers: 4,
  use: {
    screenshot: 'only-on-failure',
  },
})
