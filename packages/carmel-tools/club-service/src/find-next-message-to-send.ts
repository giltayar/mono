import {Temporal} from 'temporal-polyfill'

type ProcessMessageResult =
  | {
      found: false
      reason: string
    }
  | {
      found: true
      rowIndex: number
      message: string
    }

export function findNextMessageToSend(rows: string[][]): ProcessMessageResult {
  // Parse the current date and time using Temporal API for Israel timezone
  const israelTimeZone = 'Asia/Jerusalem'
  const now = Temporal.Now.zonedDateTimeISO(israelTimeZone)
  const today = now.toPlainDate()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const [date, time, sent, message] = row

    // Skip if message was already sent (column 3 has any value)
    if (sent && sent.trim() !== '') {
      continue
    }

    // Skip if message is empty
    if (!message || message.trim() === '') {
      continue
    }

    // Parse and validate the message date
    const [day, month, year] = date.split(/[/.]/).map(Number)
    const messageDate = Temporal.PlainDate.from({day, month, year})

    // Skip if message date is not today
    if (!messageDate.equals(today)) {
      continue
    }

    // Parse the message time and create a ZonedDateTime for today at that time
    const [hour, minute] = time.split(':').map(Number)
    const messageTime = Temporal.PlainTime.from({hour, minute})
    const messageDateTime = today.toZonedDateTime({
      timeZone: israelTimeZone,
      plainTime: messageTime,
    })

    // Skip if it's not time yet
    if (Temporal.ZonedDateTime.compare(messageDateTime, now) > 0) {
      continue
    }

    // Found a valid message to send
    return {
      found: true,
      rowIndex: i,
      message: message,
    }
  }

  // No valid messages found
  return {
    found: false,
    reason: 'No unsent messages found',
  }
}
