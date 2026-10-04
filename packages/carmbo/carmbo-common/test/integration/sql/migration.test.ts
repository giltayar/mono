import {after, before, describe, it, type TestContext} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {copyFile, mkdir, mkdtemp, readdir, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'
import postgres, {type Sql} from 'postgres'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {migrate, migrationsRoot} from '@giltayar/carmbo-common/sql/migration'

describe('packaged database migrations', () => {
  let host: string
  let port: number
  let teardown: (() => Promise<void>) | undefined

  before(async () => {
    const docker = await runDockerCompose(new URL('./docker-compose.yaml', import.meta.url), {
      variation: randomUUID(),
      containerCleanup: true,
    })
    teardown = docker.teardown
    const address = await docker.findAddress('migration-test-postgres', 5432, {
      healthCheck: async (address) => {
        const [host, port] = address.split(':')
        const sql = postgres({
          host,
          port: Number(port),
          database: 'postgres',
          username: 'test_user',
          password: 'test_password',
        })
        try {
          await sql`SELECT 1`
        } finally {
          await sql.end()
        }
      },
    })
    ;[host] = address.split(':')
    port = Number(address.split(':')[1])
  })

  after(async () => {
    await teardown?.()
  })

  async function createDatabase(t: TestContext): Promise<Sql> {
    const options = {host, port, username: 'test_user', password: 'test_password'}
    const admin = postgres({...options, database: 'postgres'})
    const database = `migration_${randomUUID().replaceAll('-', '')}`
    try {
      await admin`CREATE DATABASE ${admin(database)}`
    } finally {
      await admin.end()
    }
    const sql = postgres({...options, database, transform: postgres.camel})
    t.after(() => sql.end())
    return sql
  }

  async function createMigrationDirectory(t: TestContext): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'carmbo-common-migrations #'))
    t.after(() => rm(directory, {recursive: true, force: true}))
    return directory
  }

  it('creates the complete schema from scratch and is idempotent', async (t) => {
    const sql = await createDatabase(t)
    await migrate({sql})

    const migrations = await sql`SELECT migration_id FROM migrations ORDER BY migration_id`
    assert.deepEqual(
      migrations.map((row) => row.migrationId),
      Array.from({length: 44}, (_, index) => index + 1),
    )
    for (const table of [
      'student',
      'product',
      'sales_event',
      'sale',
      'job',
      'product_integration_ravmesser',
      'student_integration_ravmesser',
    ]) {
      const [row] = await sql`SELECT to_regclass(${table}) AS name`
      assert.equal(row.name, table)
    }

    const before = await sql`SELECT * FROM migrations ORDER BY migration_id`
    await migrate({sql})
    assert.deepEqual(await sql`SELECT * FROM migrations ORDER BY migration_id`, before)
  })

  it('upgrades an existing database through the compiled TypeScript data migration', async (t) => {
    const sql = await createDatabase(t)
    const directory = await createMigrationDirectory(t)
    const files = (await readdir(migrationsRoot)).filter(
      (name) => /^\d{5}_.*\.sql$/.test(name) && Number(name.slice(0, 5)) <= 26,
    )
    assert.equal(files.length, 26)
    await Promise.all(
      files.map((name) => copyFile(new URL(name, migrationsRoot), join(directory, name))),
    )
    await migrate({sql, path: directory})

    const id = randomUUID()
    const dataId = randomUUID()
    const [sale] = await sql`
      INSERT INTO sale (last_history_id, last_data_id)
      VALUES (${id}, ${dataId})
      RETURNING sale_number
    `
    await sql`
      INSERT INTO sale_history (id, data_id, sale_number, operation)
      VALUES (${id}, ${dataId}, ${sale.saleNumber}, 'create')
    `

    await migrate({sql})

    const [updated] = await sql`
      SELECT connected.is_connected, active.is_active
      FROM sale_history history
      JOIN sale_data_connected connected USING (data_connected_id)
      JOIN sale_data_active active USING (data_active_id)
      WHERE history.id = ${id}
    `
    assert.deepEqual(updated, {isConnected: true, isActive: true})
    const [migration] = await sql`SELECT name FROM migrations WHERE migration_id = 27`
    assert.equal(migration.name, 'add_connected_and_active_statuses.js')
    const [latest] = await sql`SELECT max(migration_id) AS id FROM migrations`
    assert.equal(latest.id, 44)
  })

  it('ignores compiler artifacts and supports migration directories and encoded paths', async (t) => {
    const sql = await createDatabase(t)
    const directory = await createMigrationDirectory(t)
    await writeFile(join(directory, '00001_initial.sql'), 'CREATE TABLE first_migration (id int)')
    await mkdir(join(directory, '00002_directory'))
    await writeFile(
      join(directory, '00002_directory/index.js'),
      'export default async function(sql) { await sql`CREATE TABLE second_migration (id int)` }',
    )
    for (const name of [
      '00001_initial.d.ts',
      '00001_initial.d.ts.map',
      '00001_initial.js.map',
      '00003_ignored.txt',
    ]) {
      await writeFile(join(directory, name), 'not executable')
    }
    await migrate({sql, path: pathToFileURL(directory)})
    const rows = await sql`SELECT migration_id FROM migrations ORDER BY migration_id`
    assert.deepEqual(
      rows.map((row) => row.migrationId),
      [1, 2],
    )
    const [table] = await sql`SELECT to_regclass('second_migration') AS name`
    assert.equal(table.name, 'second_migration')
  })

  it('reports empty migration directories explicitly', async (t) => {
    const sql = await createDatabase(t)
    const directory = await createMigrationDirectory(t)
    await assert.rejects(migrate({sql, path: directory}), /No migrations found/)
  })
})
