import assert from 'node:assert/strict'
import test from 'node:test'
import * as jobRoutes from '@giltayar/carmbo-pages-job/routes'
import * as jobExecutor from '@giltayar/carmbo-pages-job/jobs/executor'
import * as jobHandler from '@giltayar/carmbo-pages-job/jobs/handler'
import * as testkit from '@giltayar/carmbo-pages-job/testkit'

test('publishes the intended package entry points', () => {
  assert.deepEqual(Object.keys(jobRoutes), ['apiRoutes', 'routes'])
  assert.deepEqual(Object.keys(jobExecutor), [
    'executeDirectJob',
    'initializeJobExecutor',
    'triggerJobsExecution',
  ])
  assert.deepEqual(Object.keys(jobHandler), ['registerJobHandler'])
  assert.deepEqual(Object.keys(testkit), ['TEST_resetJobHandlers'])
})
