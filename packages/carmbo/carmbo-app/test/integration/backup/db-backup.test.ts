import {expect, test} from '@playwright/test'
import {readFile, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {setup} from '../common/setup.ts'

const backupFile = path.join(os.tmpdir(), `carmbo-db-backup-${process.pid}.sql`)
const apiSecret = 'backup-test-secret'
const {url} = setup(import.meta.url, {databaseBackup: {backupFile, apiSecret}})

test.afterAll(async () => {
  await rm(backupFile, {force: true})
})

test('creates a PostgreSQL backup', async ({request}) => {
  const response = await request.post(new URL(`/backup/db-backup?secret=${apiSecret}`, url()).href)

  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({
    message: 'Database backup completed',
    backupFile,
  })

  const backup = await readFile(backupFile, 'utf8')
  expect(backup).toContain('PostgreSQL database dump')
  expect(backup).toContain('CREATE TABLE public.student')
})
