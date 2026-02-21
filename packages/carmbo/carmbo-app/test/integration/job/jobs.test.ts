import {test, expect} from '@playwright/test'
import {createJobListPageModel} from '../../page-model/jobs/job-list-page.model.ts'
import {setup} from '../common/setup.ts'
import {registerJobHandler} from '../../../src/domain/job/job-handlers.ts'
import {triggerJobsExecution} from '../../../src/domain/job/job-executor.ts'

const {url} = setup(import.meta.url)

let submitTestJob: Awaited<ReturnType<typeof registerJobHandler<{name: string}>>>
let submitFailingJob: Awaited<ReturnType<typeof registerJobHandler<{name: string}>>>
let submitParentJob: Awaited<ReturnType<typeof registerJobHandler<number>>>
let submitPartialParentJob: Awaited<ReturnType<typeof registerJobHandler<number>>>
let submitPendingJob: Awaited<ReturnType<typeof registerJobHandler<{name: string}>>>

test.beforeAll(() => {
  submitTestJob = registerJobHandler<{name: string}>('test-job', async ({payload}) => {
    return {description: `Processed: ${payload.name}`}
  })
  submitFailingJob = registerJobHandler<{name: string}>('test-failing-job', async ({payload}) => {
    throw new Error(`Failed: ${payload.name}`)
  })
  submitPendingJob = registerJobHandler<{name: string}>('test-pending-job', async ({payload}) => {
    return {description: `Processed: ${payload.name}`}
  })
  submitParentJob = registerJobHandler<number>('test-parent-job', async ({jobId}) => {
    await submitTestJob({name: 'Sub 1'}, {parentJobId: jobId, retries: 1})
    await submitTestJob({name: 'Sub 2'}, {parentJobId: jobId, retries: 1})
    await submitTestJob({name: 'Sub 3'}, {parentJobId: jobId, retries: 1})
    return {description: 'Parent Job'}
  })
  submitPartialParentJob = registerJobHandler<number>(
    'test-partial-parent-job',
    async ({jobId}) => {
      await submitTestJob({name: 'Sub 1'}, {parentJobId: jobId, retries: 1})
      await submitTestJob({name: 'Sub 2'}, {parentJobId: jobId, retries: 1})
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      await submitPendingJob(
        {name: 'Sub 3'},
        {parentJobId: jobId, retries: 1, scheduledAt: farFuture},
      )
      return {description: 'Partial Parent Job'}
    },
  )
})

test('jobs page lists submitted jobs', async ({page}) => {
  await submitTestJob({name: 'Job Alpha'}, {retries: 1})
  await submitTestJob({name: 'Job Beta'}, {retries: 1})
  await submitTestJob({name: 'Job Gamma'}, {retries: 1})

  await triggerJobsExecution(() => new Date())

  await page.goto(new URL('/jobs', url()).href)

  const jobListModel = createJobListPageModel(page)

  await expect(jobListModel.pageTitle().locator).toHaveText('Jobs')

  const rows = jobListModel.list().rows()
  await expect(rows.locator).toHaveCount(3)

  // Jobs are ordered by created_at DESC, so newest first
  const row0 = rows.row(0)
  await expect(row0.descriptionCell().locator).toHaveText('Processed: Job Gamma')
  await expect(row0.progressCell().locator).toHaveText('1/1')
  await expect(row0.statusCell().locator).toHaveText('✔')

  const row1 = rows.row(1)
  await expect(row1.descriptionCell().locator).toHaveText('Processed: Job Beta')
  await expect(row1.progressCell().locator).toHaveText('1/1')
  await expect(row1.statusCell().locator).toHaveText('✔')

  const row2 = rows.row(2)
  await expect(row2.descriptionCell().locator).toHaveText('Processed: Job Alpha')
  await expect(row2.progressCell().locator).toHaveText('1/1')
  await expect(row2.statusCell().locator).toHaveText('✔')
})

test('jobs page shows error status for failed jobs', async ({page}) => {
  await submitFailingJob({name: 'Bad Job'}, {retries: 1})

  await triggerJobsExecution(() => new Date())

  await page.goto(new URL('/jobs', url()).href)

  const jobListModel = createJobListPageModel(page)

  const rows = jobListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)

  const row = rows.row(0)
  await expect(row.statusCell().locator).toContainText('❌')
  await expect(row.statusCell().errorSpan().locator).toHaveText('❌ Failed: Bad Job')
  await expect(row.statusCell().errorSpan().locator).toHaveAttribute('title', /Failed: Bad Job/)
})

test('jobs page shows 3/3 progress for a job with 3 completed subjobs', async ({page}) => {
  await submitParentJob(1, {retries: 1})

  await triggerJobsExecution(() => new Date())
  await triggerJobsExecution(() => new Date())

  const jobListModel = createJobListPageModel(page)

  await expect(async () => {
    await page.goto(new URL('/jobs', url()).href)
    const rows = jobListModel.list().rows()
    await expect(rows.locator).toHaveCount(1)

    const row = rows.row(0)
    await expect(row.descriptionCell().locator).toHaveText('Parent Job')
    await expect(row.progressCell().locator).toHaveText('3/3')
    await expect(row.statusCell().locator).toHaveText('✔')
  }).toPass()
})

test('jobs page shows 2/3 progress when one subjob has not finished', async ({page}) => {
  await submitPartialParentJob(1, {retries: 1})

  await triggerJobsExecution(() => new Date())

  const jobListModel = createJobListPageModel(page)

  await expect(async () => {
    await page.goto(new URL('/jobs', url()).href)
    const rows = jobListModel.list().rows()
    await expect(rows.locator).toHaveCount(1)

    const row = rows.row(0)
    await expect(row.descriptionCell().locator).toHaveText('Partial Parent Job')
    await expect(row.progressCell().locator).toHaveText('2/3')
  }).toPass()
})
