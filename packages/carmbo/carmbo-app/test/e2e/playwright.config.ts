import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir: '.',
  outputDir: './.test-results',
  preserveOutput: 'failures-only',
  expect: {timeout: 3000},
  timeout: 10000,
  use: {
    screenshot: 'only-on-failure',
  },
})
