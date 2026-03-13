import type {Sql} from 'postgres'

export type JobForGrid = {
  id: number
  description: string | null
  createdAt: Date
  finishedAt: Date | null
  scheduledAt: Date | null
  progressCount: number
  progressTotal: number
  errorMessage: string | null
  error: string | null
}

export async function listJobs(
  sql: Sql,
  {
    parentJobId,
    withTrivial,
    limit,
    page,
  }: {parentJobId: number | undefined; withTrivial: boolean; limit: number; page: number},
): Promise<JobForGrid[]> {
  const jobs = (await sql`
    SELECT
      job.id,
      job.description,
      job.created_at,
      job.finished_at,
      job.scheduled_at,
      COUNT(subjobs.*) FILTER (WHERE subjobs.finished_at IS NOT NULL) AS subjobs_progress_count,
      COUNT(subjobs.*) AS subjobs_total,
      job.error,
      job.error_message
    FROM job
    LEFT JOIN job as subjobs ON subjobs.parent_job_id = job.id
    WHERE job.parent_job_id ${parentJobId !== undefined ? sql`= ${parentJobId}` : sql`IS NULL`}
    ${!withTrivial ? sql`AND job.is_trivial = false` : sql``}
    GROUP BY job.id
    ORDER BY job.created_at DESC
    LIMIT ${limit} OFFSET ${page * limit}
  `) as {
    id: string
    description: string | null
    createdAt: Date
    finishedAt: Date | null
    scheduledAt: Date | null
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
      finishedAt: job.finishedAt,
      scheduledAt: job.scheduledAt,
      progressCount: progressTotal === 0 ? (job.finishedAt ? 1 : 0) : progressCount,
      progressTotal: progressTotal === 0 ? 1 : progressTotal,
      errorMessage: job.errorMessage,
      error: job.error,
    }
  })
}

export type JobView = {
  id: number
  description: string
  createdAt: Date
  finishedAt: Date | undefined
  errorMessage: string | undefined
  error: string | undefined
}

export async function queryJobById(jobId: number, sql: Sql): Promise<JobView | undefined> {
  const jobs = (await sql`
    SELECT
      job.id,
      job.description,
      job.created_at,
      job.finished_at,
      job.error,
      job.error_message
    FROM job
    LEFT JOIN job as subjobs ON subjobs.parent_job_id = job.id
    WHERE job.id = ${jobId}
    GROUP BY job.id
  `) as {
    id: string
    description: string | null
    createdAt: Date
    finishedAt: Date | null
    errorMessage: string | null
    error: string | null
  }[]

  return jobs.length > 0
    ? {
        id: parseInt(jobs[0].id, 10),
        description: jobs[0].description ?? '',
        createdAt: jobs[0].createdAt,
        finishedAt: jobs[0].finishedAt ?? undefined,
        errorMessage: jobs[0].errorMessage ?? undefined,
        error: jobs[0].error ?? undefined,
      }
    : undefined
}
