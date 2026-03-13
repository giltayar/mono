import {test, expect} from '@playwright/test'
import {createJobListPageModel} from '../../page-model/jobs/job-list-page.model.ts'
import {createJobPageModel} from '../../page-model/jobs/job-page.model.ts'
import {setup} from '../common/setup.ts'
import {registerJobHandler} from '../../../src/domain/job/job-handlers.ts'
import {triggerJobsExecution} from '../../../src/domain/job/job-executor.ts'

const {url} = setup(import.meta.url)

let submitTestJob: Awaited<ReturnType<typeof registerJobHandler<{name: string}>>>
let submitFailingJob: Awaited<ReturnType<typeof registerJobHandler<{name: string}>>>
let submitParentJob: Awaited<ReturnType<typeof registerJobHandler<number>>>
let submitDescriptionOverrideJob: Awaited<ReturnType<typeof registerJobHandler<{name: string}>>>

const nowService = () => new Date()

test.beforeAll(() => {
  submitTestJob = registerJobHandler<{name: string}>(
    'test-job',
    nowService,
    {isTrivial: false},
    (payload) => `Processed: ${payload.name}`,
    async () => {},
  )
  submitFailingJob = registerJobHandler<{name: string}>(
    'test-failing-job',
    nowService,
    {isTrivial: false},
    (payload) => `Failed: ${payload.name}`,
    async ({payload}) => {
      throw new Error(`Failed: ${payload.name}`)
    },
  )
  submitParentJob = registerJobHandler<number>(
    'test-parent-job',
    nowService,
    {isTrivial: false},
    () => 'Parent Job',
    async ({jobId}) => {
      await submitTestJob({name: 'Sub 1'}, {parentJobId: jobId, retries: 1})
      await submitTestJob({name: 'Sub 2'}, {parentJobId: jobId, retries: 1})
      await submitTestJob({name: 'Sub 3'}, {parentJobId: jobId, retries: 1})
    },
  )
  submitDescriptionOverrideJob = registerJobHandler<{name: string}>(
    'test-description-override-job',
    nowService,
    {isTrivial: false},
    (payload) => `Initial: ${payload.name}`,
    async ({payload}) => {
      return {description: `Overridden: ${payload.name}`}
    },
  )
})

test('job page shows details for a simple job and a job with subjobs', async ({page}) => {
  await submitTestJob({name: 'Simple Job'}, {retries: 1})
  await submitParentJob(1, {retries: 1})

  await page.goto(new URL('/jobs', url()).href)

  const jobListModel = createJobListPageModel(page)
  const jobPageModel = createJobPageModel(page)

  // Click on the simple job (it's the first one created, so last in the desc-sorted list)
  await expect(async () => {
    await page.goto(new URL('/jobs', url()).href)
    await expect(jobListModel.list().rows().locator).toHaveCount(2)
  }).toPass()

  const simpleJobRow = jobListModel.list().rows().row(1)
  await simpleJobRow.idLink().locator.click()

  await page.waitForURL(jobPageModel.urlRegex)

  await expect(jobPageModel.pageTitle().locator).toContainText('Processed: Simple Job')
  await expect(jobPageModel.pageTitle().locator).toContainText('✔')
  await expect(jobPageModel.createdAt().locator).toContainText('Created:')
  await expect(jobPageModel.finishedAt().locator).toContainText(new Date().getFullYear().toString())

  // No subjobs table for a simple job
  await expect(jobPageModel.subjobsList().locator).toHaveCount(0)

  // Navigate back to jobs list and click on the parent job
  await page.goto(new URL('/jobs', url()).href)

  const parentJobRow = jobListModel.list().rows().row(0)
  await parentJobRow.idLink().locator.click()

  await page.waitForURL(jobPageModel.urlRegex)

  await expect(jobPageModel.pageTitle().locator).toContainText('Parent Job')
  await expect(jobPageModel.pageTitle().locator).toContainText('✔')
  await expect(jobPageModel.finishedAt().locator).toContainText(new Date().getFullYear().toString())

  // Subjobs table should show the 3 subjobs
  const subjobRows = jobPageModel.subjobsList().rows()
  await expect(subjobRows.locator).toHaveCount(3)

  await expect(subjobRows.row(0).descriptionCell().locator).toHaveText('Processed: Sub 3')
  await expect(subjobRows.row(0).statusCell().locator).toHaveText('✔')

  await expect(subjobRows.row(1).descriptionCell().locator).toHaveText('Processed: Sub 2')
  await expect(subjobRows.row(1).statusCell().locator).toHaveText('✔')

  await expect(subjobRows.row(2).descriptionCell().locator).toHaveText('Processed: Sub 1')
  await expect(subjobRows.row(2).statusCell().locator).toHaveText('✔')
})

test('job page shows error details for a failed job', async ({page}) => {
  await submitFailingJob({name: 'Bad Job'}, {retries: 1})

  // Because it's a failing job, it will retry once, and so we need to trigger the job execution
  // so it can do the retry
  await triggerJobsExecution(nowService)

  const jobListModel = createJobListPageModel(page)
  const jobPageModel = createJobPageModel(page)

  await page.goto(new URL('/jobs', url()).href)
  await expect(jobListModel.list().rows().locator).toHaveCount(1)

  await jobListModel.list().rows().row(0).idLink().locator.click()
  await page.waitForURL(jobPageModel.urlRegex)

  await expect(jobPageModel.pageTitle().locator).toContainText('❌')
  await expect(jobPageModel.pageTitle().locator).toContainText('Failed: Bad Job')
  await expect(jobPageModel.pageTitle().statusIndicator().locator).toHaveAttribute(
    'title',
    /Failed: Bad Job/,
  )
  await expect(jobPageModel.finishedAt().locator).toContainText(new Date().getFullYear().toString())
  await expect(jobPageModel.subjobsList().locator).toHaveCount(0)
})

test('job page shows overridden description when handler returns one', async ({page}) => {
  await submitDescriptionOverrideJob({name: 'Override Test'}, {retries: 1})

  const jobListModel = createJobListPageModel(page)
  const jobPageModel = createJobPageModel(page)

  await expect(async () => {
    await page.goto(new URL('/jobs', url()).href)
    await expect(jobListModel.list().rows().locator).toHaveCount(1)
  }).toPass()

  await jobListModel.list().rows().row(0).idLink().locator.click()
  await page.waitForURL(jobPageModel.urlRegex)

  await expect(jobPageModel.pageTitle().locator).toContainText('Overridden: Override Test')
})
