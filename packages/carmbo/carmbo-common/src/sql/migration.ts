/// Copied (and modified) from https://github.com/porsager/postgres-shift/commit/da61a6142c4aca097d0d1a091d4c0ea148468119

import fs from 'node:fs'
import {join, basename} from 'node:path'
import retry from 'p-retry'
import type {Sql} from 'postgres'
import {fileURLToPath, pathToFileURL} from 'node:url'

export const migrationsRoot: URL = new URL('./', import.meta.url)

export async function migrate({
  sql,
  path = migrationsRoot,
}: {
  sql: Sql
  path?: string | URL
}): Promise<void> {
  await retry(() => sql`select 1`, {
    retries: 10,
    minTimeout: 1000,
    maxTimeout: 1000,
  })

  if (path instanceof URL) {
    path = fileURLToPath(path)
  }

  const migrations = fs
    .readdirSync(path)
    .filter((x) => {
      if (!/^[0-9]{5}_/.test(x)) return false

      const stat = fs.statSync(join(path, x))
      return (
        stat.isDirectory() || (stat.isFile() && /\.(sql|js|ts)$/.test(x) && !x.endsWith('.d.ts'))
      )
    })
    .sort()
    .map((x) => ({
      path: join(path, x),
      migration_id: parseInt(x.slice(0, 5)),
      name: x.slice(6).replace(/-/g, ' '),
    }))

  const latest = migrations[migrations.length - 1]

  if (!latest) throw new Error(`No migrations found in ${path}`)

  if (latest.migration_id !== migrations.length)
    throw new Error(
      `Inconsistency in migration numbering: latest is ${latest.migration_id} and there are ${migrations.length} migrations`,
    )

  await ensureMigrationsTable()

  const current = await getCurrentMigration()
  const needed = migrations.slice(current ? current.id : 0)

  await sql.begin(next)

  async function next(sql: Sql) {
    const current = needed.shift()
    if (!current) return

    if (process.env.NODE_ENV !== 'test') {
      console.log('running migration', basename(current.path))
    }
    await run(sql, current)
    await next(sql)
  }

  async function run(
    sql: Sql,
    {path, migration_id, name}: {path: string; migration_id: number; name: string},
  ) {
    if (fs.statSync(path).isFile()) {
      if (path.endsWith('.sql')) {
        await sql.file(path)
      } else {
        await import(pathToFileURL(path).href).then((x) => x.default(sql))
      }
    } else if (fs.statSync(path).isDirectory()) {
      if (fs.existsSync(join(path, 'index.sql')) && !fs.existsSync(join(path, 'index.js'))) {
        await sql.file(join(path, 'index.sql'))
      } else if (fs.existsSync(join(path, 'index.js'))) {
        await import(pathToFileURL(join(path, 'index.js')).href).then((x) => x.default(sql))
      } else {
        await import(pathToFileURL(join(path, 'index.ts')).href).then((x) => x.default(sql))
      }
    }
    await sql`
      insert into migrations (
        migration_id,
        name
      ) values (
        ${migration_id},
        ${name}
      )
    `
  }

  function getCurrentMigration() {
    return sql`
      select migration_id as id from migrations
      order by migration_id desc
      limit 1
    `.then(([x]) => x)
  }

  function ensureMigrationsTable() {
    return sql`
      select 'migrations'::regclass
    `.catch(
      () => sql`
      create table migrations (
        migration_id serial primary key,
        created_at timestamp with time zone not null default now(),
        name text
      )
    `,
    )
  }
}
