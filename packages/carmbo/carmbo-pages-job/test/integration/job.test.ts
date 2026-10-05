import {expect, test} from '@playwright/test'
import {triggerJobsExecution} from '@giltayar/carmbo-pages-job/jobs/executor'
import {registerJobHandler} from '@giltayar/carmbo-pages-job/jobs/handler'
import {baseNow, executionNow, setupJobRoutes} from './setup.ts'

const {url} = setupJobRoutes(import.meta.url)

test('job page shows details for a simple job and a job with subjobs', async ({page}) => {
  let nowOffset = 0
  const submitTestJob = registerJobHandler(
    'details-test-job',
    () => new Date(baseNow.getTime() + nowOffset++),
    {isTrivial: false},
    ({name}: {name: string}) => `Processed: ${name}`,
    async () => {},
  )
  const submitParentJob = registerJobHandler(
    'details-parent-job',
    () => baseNow,
    {isTrivial: false},
    () => 'Parent Job',
    async ({jobId}) => {
      await submitTestJob(
        {name: 'Sub 1'},
        {parentJobId: jobId, scheduledAt: executionNow, retries: 1},
      )
      await submitTestJob(
        {name: 'Sub 2'},
        {parentJobId: jobId, scheduledAt: executionNow, retries: 1},
      )
      await submitTestJob(
        {name: 'Sub 3'},
        {parentJobId: jobId, scheduledAt: executionNow, retries: 1},
      )
    },
  )

  const simpleJobId = await submitTestJob(
    {name: 'Simple Job'},
    {scheduledAt: executionNow, retries: 1},
  )
  const parentJobId = await submitParentJob(1, {scheduledAt: executionNow, retries: 1})
  await triggerJobsExecution(() => executionNow)
  await triggerJobsExecution(() => executionNow)

  await page.goto(new URL(`/jobs/${simpleJobId}`, url()).href)

  await expect(page.locator('h2').first()).toContainText('Processed: Simple Job')
  await expect(page.locator('h2').first()).toContainText('✔')
  await expect(page.locator('p', {hasText: 'Created:'})).toBeVisible()
  await expect(page.locator('p', {hasText: 'Finished:'})).toContainText('2026')
  await expect(page.locator('table')).toHaveCount(0)

  await page.goto(new URL(`/jobs/${parentJobId}`, url()).href)

  await expect(page.locator('h2').first()).toContainText('Parent Job')
  await expect(page.locator('h2').first()).toContainText('✔')
  await expect(page.locator('p', {hasText: 'Finished:'})).toContainText('2026')

  const rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0).locator('td').nth(1)).toHaveText('Processed: Sub 3')
  await expect(rows.nth(0).locator('td').nth(4)).toHaveText('✔')
  await expect(rows.nth(1).locator('td').nth(1)).toHaveText('Processed: Sub 2')
  await expect(rows.nth(1).locator('td').nth(4)).toHaveText('✔')
  await expect(rows.nth(2).locator('td').nth(1)).toHaveText('Processed: Sub 1')
  await expect(rows.nth(2).locator('td').nth(4)).toHaveText('✔')
})

test('job page shows error details for a failed job', async ({page}) => {
  const submitFailingJob = registerJobHandler(
    'details-failing-job',
    () => baseNow,
    {isTrivial: false},
    ({name}: {name: string}) => `Failed: ${name}`,
    async ({payload}) => {
      throw new Error(`Failed: ${payload.name}`)
    },
  )

  const jobId = await submitFailingJob({name: 'Bad Job'}, {scheduledAt: executionNow, retries: 1})
  await triggerJobsExecution(() => executionNow)
  await triggerJobsExecution(() => executionNow)

  await page.goto(new URL(`/jobs/${jobId}`, url()).href)

  const heading = page.locator('h2').first()
  await expect(heading).toContainText('❌')
  await expect(heading).toContainText('Failed: Bad Job')
  await expect(heading.locator('span.error')).toHaveAttribute('title', /Failed: Bad Job/)
  await expect(page.locator('p', {hasText: 'Finished:'})).toContainText('2026')
  await expect(page.locator('table')).toHaveCount(0)
})

test('job page shows overridden description when handler returns one', async ({page}) => {
  const submitDescriptionOverrideJob = registerJobHandler(
    'description-override-job',
    () => baseNow,
    {isTrivial: false},
    ({name}: {name: string}) => `Initial: ${name}`,
    async ({payload}) => ({description: `Overridden: ${payload.name}`}),
  )

  const jobId = await submitDescriptionOverrideJob(
    {name: 'Override Test'},
    {scheduledAt: executionNow, retries: 1},
  )
  await triggerJobsExecution(() => executionNow)

  await page.goto(new URL(`/jobs/${jobId}`, url()).href)

  await expect(page.locator('h2').first()).toContainText('Overridden: Override Test')
})

test('job page shows clock emoji for an unfinished job', async ({page}) => {
  const futureDate = new Date('2027-01-01T00:00:00.000Z')
  const submitScheduledJob = registerJobHandler(
    'details-scheduled-job',
    () => baseNow,
    {isTrivial: false},
    ({name}: {name: string}) => `Scheduled: ${name}`,
    async () => {},
  )

  const jobId = await submitScheduledJob(
    {name: 'Pending Job'},
    {scheduledAt: futureDate, retries: 1},
  )
  await triggerJobsExecution(() => baseNow)

  await page.goto(new URL(`/jobs/${jobId}`, url()).href)

  await expect(page.locator('h2').first()).toContainText('Scheduled: Pending Job')
  await expect(page.locator('h2').first()).toContainText('🕐')
  await expect(page.locator('p', {hasText: 'Finished:'})).toContainText('still working...')
})
