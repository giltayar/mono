import type {ClubServiceData} from './club-service-types.ts'
import {findNextMessageToSend} from './find-next-message-to-send.ts'

export async function sendDailyWhatsAppMessage(s: ClubServiceData): Promise<void> {
  const {
    context: {services, whatsappGroupId, dailyMessagesGoogleSheetTabIndex},
  } = s

  const logger = services.logger.child({operation: 'send-daily-whatsapp-message'})

  logger.info(`reading-sheet`)
  const sheetData = await services.googleSheets.readGoogleSheet(
    s.context.dailyMessagesGoogleSheet,
    {
      numberOfColumns: 4,
      sheetIndex: dailyMessagesGoogleSheetTabIndex,
      maxRows: 3000,
    },
  )

  const result = findNextMessageToSend(sheetData.rows)

  if (!result.found) {
    logger.info('no-unsent-messages-found', {reason: result.reason})
    return
  }

  const {rowIndex, message} = result

  const rowInSheet = rowIndex + 2 // +2 because of header row and 1-based indexing

  logger.info(`Found unsent message at row ${rowInSheet}`) // +2 because of header row and 1-based indexing

  logger.info('sending-message', {whatsappGroupId, message: message.slice(0, 20)})

  // Send the WhatsApp message
  await services.whatsapp.sendMessageToGroup(whatsappGroupId, message)

  logger.info(`writing-to-google-sheet`, {
    sheetIndex: dailyMessagesGoogleSheetTabIndex,
    row: rowInSheet,
    sheetUrl: s.context.dailyMessagesGoogleSheet.href,
  })
  await services.googleSheets.writeGoogleSheet(s.context.dailyMessagesGoogleSheet, {
    sheetIndex: 0,
    dataToWrite: [{row: rowInSheet, column: 3, value: 'x'}],
  })
}
