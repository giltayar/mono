import type {Sql} from 'postgres'

export default async function addConnectedAndActiveStatusesToAllSales(sql: Sql) {
  const latestSaleHistories = (await sql`
    SELECT
      sale.sale_number, sale_history.id, sale_history.data_connected_id, sale_history.data_active_id
    FROM sale
    LEFT JOIN sale_history ON sale_history.id = sale.last_history_id
    WHERE
      sale_history.data_connected_id IS NULL OR sale_history.data_active_id IS NULL
    ORDER BY sale.sale_number ASC
  `) as {
    saleNumber: string
    id: string
    dataConnectedId: string | null
    dataActiveId: string | null
  }[]

  console.log('number of sales to update:', latestSaleHistories.length)

  for (const sale of latestSaleHistories) {
    const {saleNumber, id, dataConnectedId, dataActiveId} = sale

    console.log('updating sale', saleNumber)

    if (dataConnectedId === null) {
      const dataConnectedId = crypto.randomUUID()

      await sql`
        UPDATE sale_history
        SET data_connected_id = ${dataConnectedId}
        WHERE id = ${id}
      `

      await sql`
        INSERT INTO sale_data_connected ${sql({dataConnectedId, isConnected: true})}
      `
    }

    if (dataActiveId === null) {
      const dataActiveId = crypto.randomUUID()

      await sql`
        UPDATE sale_history
        SET data_active_id = ${dataActiveId}
        WHERE id = ${id}
      `

      await sql`
        INSERT INTO sale_data_active ${sql({dataActiveId, isActive: true})}
      `
    }
  }
}
