# carmbo-pages-job

Job pages and single-server background job execution for Carmbo applications.
The host runs the published commons migrations and calls `initializeJobExecutor(sql, logger)`
before submitting jobs.

## Registering and submitting jobs

Register each handler once at startup, before accepting requests that submit its jobs:

```ts
import {initializeJobExecutor} from '@giltayar/carmbo-pages-job/jobs/executor'
import {registerJobHandler} from '@giltayar/carmbo-pages-job/jobs/handler'

initializeJobExecutor(sql, logger)

const submitJob = registerJobHandler(
  'example',
  nowService,
  {isTrivial: false},
  (payload: {message: string}) => payload.message,
  async ({payload, jobId, isLastAttempt}, attempt, logger) => {
    logger.info({jobId, attempt, isLastAttempt}, payload.message)
    // Throw on failure so the executor records the error and retries if allowed.
  },
)

const jobId = await submitJob({message: 'Hello'}, {})
```

Registration installs the function; it does not send or execute anything. Ordinary submission
inserts the job and automatically triggers background execution without waiting for it to finish.
Options are `parentJobId`, `scheduledAt`, `retries`, and `transaction`. The retry default is three,
meaning four total attempts. Attempts are zero-based: with three retries, attempts 0 through 2
have `isLastAttempt: false` and attempt 3 has `isLastAttempt: true`. With zero retries, the first
attempt is already the last. The flag describes the retry budget, regardless of whether that
attempt succeeds or throws. Existing handlers may continue to use only `payload` and `jobId`.

The public handler entry point also exports the `JobHandler`, `JobSubmitter`, and
`JobSubmissionOptions` types.

## Submitting inside a transaction

Pass the transaction connection supplied by `postgres.begin` to insert the job atomically with
other records. Transactional submission never automatically triggers execution:

```ts
import {triggerJobsExecution} from '@giltayar/carmbo-pages-job/jobs/executor'

const jobId = await sql.begin(async (transaction) => {
  // Write the related domain records using this same transaction.
  return await submitJob({message: 'Created atomically'}, {transaction})
})

await triggerJobsExecution(nowService)
```

Only trigger execution after `begin` resolves successfully, meaning the transaction committed.
A rollback removes the job with the other writes. The returned job ID is provisional until commit.
Do not invoke `triggerJobsExecution` from inside the transaction, and do not pass an already
completed transaction. Scheduled jobs still wait until `scheduledAt` is due.

Triggering runs eligible jobs and existing garbage collection; it is not restricted to the newly
submitted job. If the process exits after commit but before the trigger, the job remains queued
and can run on a later trigger, including the host's periodic job-execution API call.
Retries also run on subsequent triggers; there is no new retry scheduler or backoff policy.
The executor uses an existing process-local mutex, not multi-server job claiming.

## Verification

Run `pnpm build` before `pnpm test`. Node tests include a PostgreSQL-backed executor suite and
compiled public-export checks. `pnpm test:playwright` covers job pages and the execution API.
Docker is required for database tests; browser tests also require Playwright Chromium.

Only the user publishes. After validation, publish this package separately before updating
dependent packages to consume its supplied published version; there is no workspace linking.
