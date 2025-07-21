import {test} from 'node:test'
import assert from 'node:assert'
import {createGoogleSheetsIntegrationService} from '@giltayar/carmel-tools-google-sheets-integration/service'

test('Google Sheets integration - write and read values', async () => {
  const privateKeyJson = process.env.GOOGLE_SHEETS_API_KEY
  if (!privateKeyJson) {
    throw new Error('GOOGLE_SHEETS_API_KEY environment variable not set')
  }

  const service = await createGoogleSheetsIntegrationService({
    privateKeyJson,
  })

  const sheetUrl = new URL(
    'https://docs.google.com/spreadsheets/d/1NmW1guwyxuCKyvcS2E-Zdye8o8xncz843DHvHFFfd4A/edit?gid=0#gid=0',
  )

  const testValues = [
    {row: 2, column: 1, value: `test-${Math.random().toString(36).substring(2, 8)}`},
    {row: 2, column: 2, value: `value-${Math.floor(Math.random() * 1000)}`},
    {row: 3, column: 1, value: `data-${Math.random().toString(36).substring(2, 8)}`},
    {row: 3, column: 2, value: `number-${Math.floor(Math.random() * 1000)}`},
  ]

  await service.writeGoogleSheet(sheetUrl, {sheetIndex: 0, dataToWrite: testValues})

  const result = await service.readGoogleSheet(sheetUrl, {
    sheetIndex: 0,
    numberOfColumns: 2,
    maxRows: 10,
  })

  assert.ok(result.rows.length >= 2, 'Should have at least 2 data rows')

  assert.strictEqual(
    result.rows[0][0],
    testValues[0].value,
    `First cell should match: expected ${testValues[0].value}, got ${result.rows[0][0]}`,
  )
  assert.strictEqual(
    result.rows[0][1],
    testValues[1].value,
    `Second cell should match: expected ${testValues[1].value}, got ${result.rows[0][1]}`,
  )

  assert.strictEqual(
    result.rows[1][0],
    testValues[2].value,
    `Third cell should match: expected ${testValues[2].value}, got ${result.rows[1][0]}`,
  )
  assert.strictEqual(
    result.rows[1][1],
    testValues[3].value,
    `Fourth cell should match: expected ${testValues[3].value}, got ${result.rows[1][1]}`,
  )
})
