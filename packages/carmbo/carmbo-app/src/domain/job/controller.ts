import type {Sql} from 'postgres'
import {finalHtml, type ControllerResult} from '../../commons/controller-result.ts'
import {listJobs} from './model.ts'
import {renderJobsPage} from './view/list.ts'

export async function showJobs(sql: Sql, {page}: {page: number}): Promise<ControllerResult> {
  const jobs = await listJobs(sql, {limit: 50, page, parentJobId: undefined})

  return finalHtml(renderJobsPage(jobs, {page}))
}
