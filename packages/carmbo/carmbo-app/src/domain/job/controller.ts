import type {Sql} from 'postgres'
import {finalHtml, type ControllerResult} from '../../commons/controller-result.ts'
import {listJobs, queryJobById} from './model.ts'
import {renderJobPage, renderJobsPage} from './view/view.ts'

export async function showJobs(
  sql: Sql,
  {page, withTrivial}: {page: number; withTrivial: boolean},
): Promise<ControllerResult> {
  const jobs = await listJobs(sql, {limit: 50, page, parentJobId: undefined, withTrivial})

  return finalHtml(renderJobsPage(jobs, {page, withTrivial}))
}

export async function showJob(jobId: number, sql: Sql): Promise<ControllerResult> {
  const [subjobs, job] = await Promise.all([
    listJobs(sql, {limit: 1000, page: 0, parentJobId: jobId, withTrivial: true}),
    queryJobById(jobId, sql),
  ])

  if (job === undefined) {
    return {status: 404, body: 'Job not found'}
  }

  return finalHtml(renderJobPage(job, subjobs))
}
