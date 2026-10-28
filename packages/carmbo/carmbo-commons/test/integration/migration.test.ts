import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {test} from 'node:test'
import {runDockerCompose, tcpHealthCheck} from '@giltayar/docker-compose-testkit'
import postgres from 'postgres'
import {migrate} from '../../src/sql/migration.ts'

test('all SQL migrations run without errors or warnings on a fresh database', async () => {
  const {findAddress, teardown} = await runDockerCompose(
    new URL('./docker-compose.yaml', import.meta.url),
    {containerCleanup: true, variation: randomUUID()},
  )

  try {
    const address = await findAddress('migration-postgres', 5432, {healthCheck: tcpHealthCheck})
    const [host, port] = address.split(':')
    const warnings: string[] = []
    const sql = postgres({
      host,
      port: parseInt(port, 10),
      database: 'migration_test',
      user: 'test_user',
      password: 'test_password',
      onnotice: (notice) => {
        if (notice.severity === 'WARNING') {
          warnings.push(notice.message)
        }
      },
    })

    try {
      await assert.doesNotReject(() => migrate({sql}))
      assert.deepEqual(warnings, [])
    } finally {
      await sql.end()
    }
  } finally {
    await teardown()
  }
})
