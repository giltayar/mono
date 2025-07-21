import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import {google} from 'googleapis'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'

export interface GoogleSheetsIntegrationServiceContext {
  privateKeyJson: string
}

type GoogleSheetsIntegrationServiceData = {
  context: GoogleSheetsIntegrationServiceContext
  sheets: Awaited<ReturnType<typeof initializeSheetsApi>>
}

export async function createGoogleSheetsIntegrationService(
  context: GoogleSheetsIntegrationServiceContext,
) {
  const sheets = await initializeSheetsApi(context)
  const sBind: ServiceBind<GoogleSheetsIntegrationServiceData> = (f) => bind(f, {context, sheets})

  return {
    readGoogleSheet: sBind(readGoogleSheet),
    writeGoogleSheet: sBind(writeGoogleSheet),
  }
}

export type GoogleSheetsIntegrationService = Awaited<
  ReturnType<typeof createGoogleSheetsIntegrationService>
>

interface GoogleSheetInformationRead {
  columnHeaders: string[]
  rows: string[][]
}

export async function readGoogleSheet(
  s: GoogleSheetsIntegrationServiceData,
  url: URL,
  options: {numberOfColumns: number; sheetIndex: number; maxRows: number},
): Promise<GoogleSheetInformationRead> {
  const sheets = s.sheets

  const spreadsheetId = extractSpreadsheetIdFromUrl(url)
  const sheetName = await findSheetNameByIndex(s, spreadsheetId, options.sheetIndex)

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
  const sheets = s.sheets
  const spreadsheetId = extractSpreadsheetIdFromUrl(url)
  const sheetName = await findSheetNameByIndex(s, spreadsheetId, options.sheetIndex)

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: options.dataToWrite.map(({row, column, value}) => ({
        range: `${sheetName}!R${row}C${column}`,
        majorDimension: 'ROWS',
        values: [[value]],
      })),
    },
  })
}

async function initializeSheetsApi(s: GoogleSheetsIntegrationServiceContext) {
  return google.sheets({
    version: 'v4',
    auth: new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      keyFilename: await generateKeyFile(s.privateKeyJson),
    }),
  })
}

async function findSheetNameByIndex(
  s: GoogleSheetsIntegrationServiceData,
  spreadsheetId: string,
  sheetIndex: number,
) {
  const spreadsheetInfo = await s.sheets.spreadsheets.get({
    spreadsheetId,
  })

  // Use the first sheet if no specific sheet is specified
  const sheetName = spreadsheetInfo.data.sheets?.[sheetIndex]?.properties?.title
  if (!sheetName) {
    throw new Error('No sheets found in the spreadsheet')
  }
  return sheetName
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

async function generateKeyFile(privateKeyJson: string): Promise<string> {
  const keyFilePath = path.join(os.tmpdir(), `keyfile-${crypto.randomUUID()}.json`)

  await fs.writeFile(keyFilePath, privateKeyJson)

  return keyFilePath
}
