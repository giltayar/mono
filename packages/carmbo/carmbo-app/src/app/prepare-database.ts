import {migrate} from '@giltayar/carmbo-common/sql/migration'
import type {Sql} from 'postgres'

export async function prepareDatabase(sql: Sql) {
  await migrate({sql})
}
