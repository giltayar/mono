import type {Sql} from 'postgres'

export type JobForGrid = {
  id: number
  description: string | null
  createdAt: Date
  progressCount: number
  progressTotal: number
  errorMessage: string | null
  error: string | null
}

export async function listJobs(
  sql: Sql,
  {parentJobId, limit, page}: {parentJobId: number | undefined; limit: number; page: number},
): Promise<JobForGrid[]> {
  const jobs = (await sql`
    SELECT
      job.id,
      job.description,
      job.created_at,
      job.finished_at,
      COUNT(subjobs.*) FILTER (WHERE subjobs.finished_at IS NOT NULL) AS subjobs_progress_count,
      COUNT(subjobs.*) AS subjobs_total,
      job.error,
      job.error_message
    FROM job
    LEFT JOIN job as subjobs ON subjobs.parent_job_id = job.id
    WHERE job.parent_job_id ${parentJobId !== undefined ? sql`= ${parentJobId}` : sql`IS NULL`}
    GROUP BY job.id
    ORDER BY job.created_at DESC
    LIMIT ${limit} OFFSET ${page * limit}
  `) as {
    id: string
    description: string | null
    createdAt: Date
    finishedAt: Date | null
    subjobsProgressCount: string
    subjobsTotal: string
    errorMessage: string | null
    error: string | null
  }[]

  return jobs.map((job) => {
    const progressCount = parseInt(job.subjobsProgressCount, 10)
    const progressTotal = parseInt(job.subjobsTotal, 10)

    return {
      id: parseInt(job.id, 10),
      description: job.description,
      createdAt: job.createdAt,
      progressCount: progressTotal === 0 ? (job.finishedAt ? 1 : 0) : progressCount,
      progressTotal: progressTotal === 0 ? 1 : progressTotal,
      errorMessage: job.errorMessage,
      error: job.error,
    }
  })
}
