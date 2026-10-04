import type {Sql} from 'postgres'

export function sqlTextSearch(query: string, sql: Sql) {
  return sql`ILIKE '%' || ${sql`${likeEscape(query)}`} || '%'`
}

function likeEscape(query: string) {
  return query.replace(/[%_\\]/g, (m) => `\\${m}`)
}
