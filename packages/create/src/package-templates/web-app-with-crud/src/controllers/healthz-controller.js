/**
 * @param {import('pg').Pool} pool
 */
export function healthz(pool) {
  return async () => {
    const result = await pool.query('select 42 as theAnswer')

    if (result.rowCount !== 1) throw new Error('pinging db returned wrong row count')

    if (result.rows[0].theanswer !== 42) throw new Error('pinging db returned wrong row')

    return {}
  }
}
