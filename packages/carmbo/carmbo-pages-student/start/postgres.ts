import {migrate} from '@giltayar/carmbo-commons/sql/migration'
import {setTimeout as delay} from 'node:timers/promises'
import postgres, {type Sql} from 'postgres'

export async function initializePostgres(): Promise<Sql> {
  const database = postgres({
    host: '127.0.0.1',
    port: 5433,
    database: 'carmbo_student',
    user: 'user',
    password: 'password',
    transform: {...postgres.camel},
  })

  await waitForDatabase(database)
  await migrate({sql: database})

  return database
}

async function waitForDatabase(sql: Sql): Promise<void> {
  const deadline = Date.now() + 30_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      await sql`SELECT 1`
      return
    } catch (error) {
      lastError = error
      await delay(250)
    }
  }

  throw new Error('PostgreSQL did not become ready within 30 seconds', {cause: lastError})
}
