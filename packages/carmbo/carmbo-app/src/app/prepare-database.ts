import {fileURLToPath} from 'node:url'
import {migrate} from '../sql/migration.ts'
import type {Sql} from 'postgres'
import retry from 'p-retry'
import {TEST_seedStudents} from '../domain/student/model.ts'
import {TEST_seedProducts} from '../domain/product/model.ts'
import {TEST_seedSalesEvents} from '../domain/sales-event/model.ts'

export async function prepareDatabase(sql: Sql) {
  await migrate({sql, path: fileURLToPath(new URL('../sql', import.meta.url))})

  await seedIfNeeded()

  async function seedIfNeeded() {
    const seedCount = process.env.TEST_SEED ? parseInt(process.env.TEST_SEED) : 0

    const studentCountResult =
      seedCount > 0
        ? await retry(() => sql<{count: string}[]>`SELECT count(*) as count FROM student LIMIT 1`, {
            retries: 5,
            minTimeout: 1000,
            maxTimeout: 1000,
          })
        : [{count: 1111}]

    if (studentCountResult[0].count === '0') {
      console.log(`Seeding ${seedCount}...`)
      await Promise.all([
        TEST_seedStudents(sql, undefined, seedCount),
        TEST_seedProducts(sql, seedCount),
        TEST_seedSalesEvents(sql, seedCount, seedCount),
      ])
      console.log(`Ended seeding ${seedCount}...`)
    }
  }
}
