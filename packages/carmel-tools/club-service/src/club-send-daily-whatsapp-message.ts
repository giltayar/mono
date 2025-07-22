import type {ClubServiceData} from './club-service-types.ts'
import {processDailyMessages} from './process-daily-messages.ts'

export async function sendDailyWhatsAppMessage(s: ClubServiceData): Promise<void> {
  const {
    context: {services, whatsappGroupId, dailyMessagesGoogleSheetTabIndex},
  } = s

  const sheetData = await services.googleSheets.readGoogleSheet(
    s.context.dailyMessagesGoogleSheet,
    {
      numberOfColumns: 4,
      sheetIndex: dailyMessagesGoogleSheetTabIndex,
      maxRows: 3000,
    },
  )

  services.logger.info(`Read ${sheetData.rows.length} rows from spreadsheet`)

  const result = processDailyMessages(sheetData.rows)

  if (!result.shouldSend) {
    services.logger.info(result.reason)
    return
  }

  const {message, messageToProcess} = result
  const messageRowIndex = messageToProcess.rowIndex

  services.logger.info(`Found unsent message at row ${messageRowIndex + 2}`) // +2 because of header row and 1-based indexing

  services.logger.info(`Sending message: "${message}" to group ${whatsappGroupId}`)

  // Send the WhatsApp message
  await services.whatsapp.sendMessageToGroup(whatsappGroupId, message)

  services.logger.info('Message sent successfully')

  // Mark the message as sent by writing "x" to column 3 (index 2)
  await services.googleSheets.writeGoogleSheet(s.context.dailyMessagesGoogleSheet, {
    sheetIndex: 0,
    dataToWrite: [
      {
        row: messageRowIndex + 2, // +2 because of header row and 1-based indexing
        column: 3, // Column C (sent status)
        value: 'x',
      },
    ],
  })

  services.logger.info(`Marked message as sent in spreadsheet row ${messageRowIndex + 2}`)
}
