import {expect, test} from '@playwright/test'
import {triggerJobsExecution} from '@giltayar/carmbo-pages-job/jobs/executor'
import {registerJobHandler} from '@giltayar/carmbo-pages-job/jobs/handler'
import {baseNow, executionNow, setupJobRoutes} from './setup.ts'

const {url} = setupJobRoutes(import.meta.url)

test('jobs page lists submitted jobs', async ({page}) => {
  let nowOffset = 0
  const submitJob = registerJobHandler(
    'list-test-job',
    () => new Date(baseNow.getTime() + nowOffset++),
    {isTrivial: false},
    ({name}: {name: string}) => `Processed: ${name}`,
    async () => {},
  )
  await submitJob({name: 'Job Alpha'}, {scheduledAt: executionNow, retries: 1})
  await submitJob({name: 'Job Beta'}, {scheduledAt: executionNow, retries: 1})
  await submitJob({name: 'Job Gamma'}, {scheduledAt: executionNow, retries: 1})
  await triggerJobsExecution(() => executionNow)

  await page.goto(new URL('/jobs', url()).href)

  await expect(page).toHaveTitle('Jobs')
  await expect(page.getByRole('heading', {name: 'Jobs'}).first()).toBeVisible()

  const rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0).locator('td').nth(1)).toHaveText('Processed: Job Gamma')
  await expect(rows.nth(0).locator('td').nth(3)).toHaveText('1/1')
  await expect(rows.nth(0).locator('td').nth(4)).toHaveText('✔')
  await expect(rows.nth(1).locator('td').nth(1)).toHaveText('Processed: Job Beta')
  await expect(rows.nth(1).locator('td').nth(3)).toHaveText('1/1')
  await expect(rows.nth(1).locator('td').nth(4)).toHaveText('✔')
  await expect(rows.nth(2).locator('td').nth(1)).toHaveText('Processed: Job Alpha')
  await expect(rows.nth(2).locator('td').nth(3)).toHaveText('1/1')
  await expect(rows.nth(2).locator('td').nth(4)).toHaveText('✔')
})

test('jobs page shows error status for failed jobs', async ({page}) => {
  const submitFailingJob = registerJobHandler(
    'list-failing-job',
    () => baseNow,
    {isTrivial: false},
    ({name}: {name: string}) => `Failed: ${name}`,
    async ({payload}) => {
      throw new Error(`Failed: ${payload.name}`)
    },
  )

  await submitFailingJob({name: 'Bad Job'}, {scheduledAt: executionNow, retries: 1})
  await triggerJobsExecution(() => executionNow)
  await triggerJobsExecution(() => executionNow)

  await page.goto(new URL('/jobs', url()).href)

  const rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows.nth(0).locator('td').nth(4)).toContainText('❌')
  await expect(rows.nth(0).locator('span.error')).toHaveText('❌ Failed: Bad Job')
  await expect(rows.nth(0).locator('span.error')).toHaveAttribute('title', /Failed: Bad Job/)
})

test('jobs page shows 3/3 progress for a job with completed subjobs', async ({page}) => {
  const submitSubjob = registerJobHandler(
    'progress-subjob',
    () => baseNow,
    {isTrivial: false},
    ({name}: {name: string}) => `Processed: ${name}`,
    async () => {},
  )
  const submitParentJob = registerJobHandler(
    'progress-parent-job',
    () => baseNow,
    {isTrivial: false},
    () => 'Parent Job',
    async ({jobId}) => {
      await submitSubjob(
        {name: 'Sub 1'},
        {parentJobId: jobId, scheduledAt: executionNow, retries: 1},
      )
      await submitSubjob(
        {name: 'Sub 2'},
        {parentJobId: jobId, scheduledAt: executionNow, retries: 1},
      )
      await submitSubjob(
        {name: 'Sub 3'},
        {parentJobId: jobId, scheduledAt: executionNow, retries: 1},
      )
    },
  )

  await submitParentJob(1, {scheduledAt: executionNow, retries: 1})
  await triggerJobsExecution(() => executionNow)
  await triggerJobsExecution(() => executionNow)

  await page.goto(new URL('/jobs', url()).href)

  const row = page.locator('table tbody tr').first()
  await expect(row.locator('td').nth(1)).toHaveText('Parent Job')
  await expect(row.locator('td').nth(3)).toHaveText('3/3')
  await expect(row.locator('td').nth(4)).toHaveText('✔')
})

test('jobs page shows 2/3 progress when one subjob has not finished', async ({page}) => {
  const farFuture = new Date('2027-01-01T00:00:00.000Z')
  const submitSubjob = registerJobHandler(
    'partial-progress-subjob',
    () => baseNow,
    {isTrivial: false},
    ({name}: {name: string}) => `Processed: ${name}`,
    async () => {},
  )
  const submitParentJob = registerJobHandler(
    'partial-progress-parent-job',
    () => baseNow,
    {isTrivial: false},
    () => 'Partial Parent Job',
    async ({jobId}) => {
      await submitSubjob(
        {name: 'Sub 1'},
        {parentJobId: jobId, scheduledAt: executionNow, retries: 1},
      )
      await submitSubjob(
        {name: 'Sub 2'},
        {parentJobId: jobId, scheduledAt: executionNow, retries: 1},
      )
      await submitSubjob({name: 'Sub 3'}, {parentJobId: jobId, scheduledAt: farFuture, retries: 1})
    },
  )

  await submitParentJob(1, {scheduledAt: executionNow, retries: 1})
  await triggerJobsExecution(() => executionNow)
  await triggerJobsExecution(() => executionNow)

  await page.goto(new URL('/jobs', url()).href)

  const row = page.locator('table tbody tr').first()
  await expect(row.locator('td').nth(1)).toHaveText('Partial Parent Job')
  await expect(row.locator('td').nth(3)).toHaveText('2/3')
})

test('trivial jobs are hidden by default and shown when requested', async ({page}) => {
  const submitNormalJob = registerJobHandler(
    'normal-job',
    () => baseNow,
    {isTrivial: false},
    ({name}: {name: string}) => `Processed: ${name}`,
    async () => {},
  )
  const submitTrivialJob = registerJobHandler(
    'trivial-job',
    () => baseNow,
    {isTrivial: true},
    ({name}: {name: string}) => `Trivial: ${name}`,
    async () => {},
  )

  await submitNormalJob({name: 'Normal Job'}, {scheduledAt: executionNow, retries: 1})
  await submitTrivialJob({name: 'Hidden Job'}, {scheduledAt: executionNow, retries: 1})
  await triggerJobsExecution(() => executionNow)

  await page.goto(new URL('/jobs', url()).href)

  let rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows.first().locator('td').nth(1)).toHaveText('Processed: Normal Job')

  await page.goto(new URL('/jobs?with-trivial=on', url()).href)

  rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(2)
})

test('jobs page shows clock emoji for a job scheduled in the future', async ({page}) => {
  const futureDate = new Date('2027-01-01T00:00:00.000Z')
  const submitScheduledJob = registerJobHandler(
    'list-scheduled-job',
    () => baseNow,
    {isTrivial: false},
    ({name}: {name: string}) => `Scheduled: ${name}`,
    async () => {},
  )

  await submitScheduledJob({name: 'Future Job'}, {scheduledAt: futureDate, retries: 1})
  await triggerJobsExecution(() => baseNow)

  await page.goto(new URL('/jobs', url()).href)

  const row = page.locator('table tbody tr').first()
  await expect(row.locator('td').nth(4)).toContainText('🕐')
  await expect(row.locator('td').nth(4).locator('span')).toHaveAttribute('title', /2027/)
})
