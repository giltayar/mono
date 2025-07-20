import {createGoogleSheetsIntegrationService} from './google-sheets-integration.ts'

const service = createGoogleSheetsIntegrationService({
  apiKey: process.env.GOOGLE_SHEETS_API_KEY || '',
})

const result = await service.readGoogleSheet(
  new URL(
    'https://docs.google.com/spreadsheets/d/1eShTuk7F_Ckc6SFvGyolgVSyAZREE1KICJtKJGXXyBc/edit?usp=sharing',
  ),
  {
    sheetIndex: 0,
    numberOfColumns: 4,
    maxRows: 10,
  },
)

console.log('rows', result.rows)

// Helper function to truncate text to max 10 characters
const truncate = (text: string | number | undefined | null): string => {
  const str = String(text || '')
  return str.length > 10 ? str.substring(0, 7) + '...' : str.padEnd(10)
}

// Create table with headers
const headers = result.columnHeaders.map((header) => truncate(header))
const separator = '+' + headers.map(() => '-'.repeat(12)).join('+') + '+'
const headerRow = '| ' + headers.join(' | ') + ' |'

console.log(separator)
console.log(headerRow)
console.log(separator)

// Print data rows
result.rows.forEach((row) => {
  const cells = row.slice(0, result.columnHeaders.length).map((cell) => truncate(cell))
  // Pad row if it has fewer cells than headers
  while (cells.length < result.columnHeaders.length) {
    cells.push(truncate(''))
  }
  const dataRow = '| ' + cells.join(' | ') + ' |'
  console.log(dataRow)
})

console.log(separator)
