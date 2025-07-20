import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import {google} from 'googleapis'
import {authenticate} from '@google-cloud/local-auth'

export interface GoogleSheetsIntegrationServiceContext {
  /**
   * Google API Key for accessing Google Sheets API
   * This can be obtained from Google Cloud Console:
   * 1. Go to https://console.cloud.google.com/
   * 2. Create a new project or select an existing one
   * 3. Enable the Google Sheets API
   * 4. Go to "Credentials" and create an API key
   * 5. Restrict the API key to Google Sheets API for security
   */
  apiKey: string
}

type GoogleSheetsIntegrationServiceData = {
  context: GoogleSheetsIntegrationServiceContext
}

export function createGoogleSheetsIntegrationService(
  context: GoogleSheetsIntegrationServiceContext,
) {
  const sBind: ServiceBind<GoogleSheetsIntegrationServiceData> = (f) => bind(f, {context})

  return {
    readGoogleSheet: sBind(readGoogleSheet),
  }
}

export type GoogleSheetsIntegrationService = ReturnType<typeof createGoogleSheetsIntegrationService>

interface GoogleSheetInformationRead {
  columnHeaders: string[]
  rows: string[][]
}

export async function readGoogleSheet(
  s: GoogleSheetsIntegrationServiceData,
  url: URL,
  options: {numberOfColumns: number; sheetIndex: number; maxRows: number},
): Promise<GoogleSheetInformationRead> {
  const sheets = google.sheets({version: 'v4', auth: s.context.apiKey})

  // Extract spreadsheet ID from URL
  const spreadsheetId = extractSpreadsheetIdFromUrl(url)

  // Get basic spreadsheet information to determine the sheet name
  const spreadsheetInfo = await sheets.spreadsheets.get({
    spreadsheetId,
  })

  // Use the first sheet if no specific sheet is specified
  const sheetName = spreadsheetInfo.data.sheets?.[options.sheetIndex]?.properties?.title
  if (!sheetName) {
    throw new Error('No sheets found in the spreadsheet')
  }

  const range = `${sheetName}!R1C1:R${options.maxRows}C${options.numberOfColumns}`

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: 'ROWS',
  })

  const allRows = response.data.values || []
  if (allRows.length === 0) {
    return {columnHeaders: [], rows: []}
  }

  const columnHeaders = allRows[0]

  // Process data rows, stopping at the first completely empty row
  const rows: string[][] = []
  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i] || []

    // Check if all relevant cells are empty
    const isEmpty = row.every((cell) => !cell || cell.toString().trim() === '')
    if (isEmpty) {
      break // Stop at first empty row
    }

    // Pad the row to ensure it has the right number of columns
    const paddedRow = new Array(options.numberOfColumns)
      .fill('')
      .map((_, idx) => (row[idx] ?? '').toString())

    rows.push(paddedRow)
  }

  return {columnHeaders, rows}
}

export async function writeGoogleSheet(
  s: GoogleSheetsIntegrationServiceData,
  url: URL,
  options: {sheetIndex: number; dataToWrite: {row: number; column: number; value: string}[]},
): Promise<void> {
  const sheets = google.sheets({version: 'v4', auth: s.context.apiKey})
  const spreadsheetId = extractSpreadsheetIdFromUrl(url)
  const requests = options.dataToWrite.map(({row, column, value}) => ({
    updateCells: {
      range: {
        sheetId: options.sheetIndex,
        startRowIndex: row - 1,
        endRowIndex: row,
        startColumnIndex: column - 1,
        endColumnIndex: column,
      },
      rows: [{values: [{userEnteredValue: {stringValue: value}}]}],
      fields: 'userEnteredValue',
    },
  }))

  const batchUpdateRequest = {
    spreadsheetId,
    resource: {
      requests,
    },
  }

  await sheets.spreadsheets.batchUpdate(batchUpdateRequest)
}

function extractSpreadsheetIdFromUrl(url: URL): string {
  // Google Sheets URLs typically look like:
  // https://docs.google.com/spreadsheets/d/{spreadsheetId}/edit#gid=0
  // or https://docs.google.com/spreadsheets/d/{spreadsheetId}/

  const pathname = url.pathname
  const match = pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)

  if (!match || !match[1]) {
    throw new Error('Invalid Google Sheets URL. Could not extract spreadsheet ID.')
  }

  return match[1]
}
