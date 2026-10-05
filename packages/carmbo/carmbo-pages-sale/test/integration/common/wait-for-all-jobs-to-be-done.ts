import {expect, type Page} from '@playwright/test'
import {createJobListPageModel} from '../../page-model/jobs/job-list-page.model.ts'

export async function waitForAllJobsToBeDone(page: Page, url: URL) {
  const jobsModel = createJobListPageModel(page)

  await expect(async () => {
    await page.goto(new URL('/jobs', url).href)

    const rows = jobsModel.list().rows()
    const count = await rows.locator.count()

    for (let i = 0; i < count; i++) {
      const text = await rows.row(i).progressCell().locator.textContent()
      const [done, total] = text!.split('/').map(Number)

      // Skip jobs that haven't started yet (e.g. scheduled for the future)
      if (done === 0 && total === 1) continue

      expect(done).toBe(total)
    }
  }).toPass()
}
