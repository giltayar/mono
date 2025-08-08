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
    logger.info({reason: result.reason}, 'no-unsent-messages-found')
    return
  }

  const {rowIndex, message} = result

  const rowInSheet = rowIndex + 2 // +2 because of header row and 1-based indexing

  logger.info({whatsappGroupId, message: message.slice(0, 20)}, 'sending-message')

  // Send the WhatsApp message
  await services.whatsapp.sendMessageToGroup(whatsappGroupId, message)

  logger.info(
    {
      sheetIndex: dailyMessagesGoogleSheetTabIndex,
      row: rowInSheet,
      sheetUrl: s.context.dailyMessagesGoogleSheet.href,
    },
    `writing-to-google-sheet`,
  )
  await services.googleSheets.writeGoogleSheet(s.context.dailyMessagesGoogleSheet, {
    sheetIndex: dailyMessagesGoogleSheetTabIndex,
    dataToWrite: [{row: rowInSheet, column: 3, value: 'x'}],
  })
}
