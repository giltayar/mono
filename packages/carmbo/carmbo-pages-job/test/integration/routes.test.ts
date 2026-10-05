import {expect, test} from '@playwright/test'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import {registerJobHandler} from '@giltayar/carmbo-pages-job/jobs/handler'
import {registerJobLocaleResources} from '../../src/locale-resources.ts'
import {baseNow, executionNow, setupJobRoutes} from './setup.ts'

const {sql, url} = setupJobRoutes(import.meta.url)

test('serves package-owned styles', async ({request}) => {
  const response = await request.get(new URL('/jobs/style.css', url()).href)

  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('text/css')
  expect(await response.text()).toContain('.students-view')
})

test('protects and executes the trigger API', async ({request}) => {
  const submitJob = registerJobHandler(
    'api-test-job',
    () => baseNow,
    {isTrivial: false},
    () => 'API-triggered job',
    async () => {},
  )
  await submitJob({}, {scheduledAt: executionNow, retries: 1})

  const forbiddenResponse = await request.post(
    new URL('/api/jobs/trigger-job-execution?secret=wrong', url()).href,
  )
  expect(forbiddenResponse.status()).toBe(403)

  const response = await request.post(
    new URL('/api/jobs/trigger-job-execution?secret=api-secret', url()).href,
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({message: 'triggered'})

  await expect
    .poll(async () => {
      const database = sql()
      const [job] = await database`SELECT finished_at FROM job`
      return job.finishedAt
    })
    .not.toBeNull()
})

test('registers and renders Hebrew job resources', async ({page}) => {
  await initializei18next('he')
  registerJobLocaleResources()

  await page.goto(new URL('/jobs', url()).href)

  await expect(page).toHaveTitle('משימות')
  await expect(page.getByRole('heading', {name: 'משימות'}).first()).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})
