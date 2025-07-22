import {test, describe} from 'node:test'
import assert from 'node:assert'
import {Temporal} from 'temporal-polyfill'
import {processDailyMessages} from '../src/process-daily-messages.ts'

describe('processDailyMessages', () => {
  const todayStr = Temporal.Now.zonedDateTimeISO('Asia/Jerusalem')
    .toPlainDate()
    .toLocaleString('en-GB')
  const tomorrowStr = Temporal.Now.zonedDateTimeISO('Asia/Jerusalem')
    .add({days: 1})
    .toPlainDate()
    .toLocaleString('en-GB')
  const yesterdayStr = Temporal.Now.zonedDateTimeISO('Asia/Jerusalem')
    .subtract({days: 1})
    .toPlainDate()
    .toLocaleString('en-GB')

  test('should return no unsent messages when all rows are empty', () => {
    const rows: string[][] = []

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: false,
      reason: 'No unsent messages found',
    })
  })

  test('should return no unsent messages when all messages are already sent', () => {
    const rows = [
      [todayStr, '10:00', 'x', 'Test message 1'],
      [todayStr, '11:00', 'sent', 'Test message 2'],
      [todayStr, '12:00', 'y', 'Test message 3'],
    ]

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: false,
      reason: 'No unsent messages found',
    })
  })

  test('should return no unsent messages when all messages are empty', () => {
    const rows = [
      [todayStr, '10:00', '', ''],
      [todayStr, '11:00', '', '   '],
      [todayStr, '12:00', '', ''],
    ]

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: false,
      reason: 'No unsent messages found',
    })
  })

  test('should skip message when date is not today (future date)', () => {
    const rows = [[tomorrowStr, '10:00', '', 'Test message for tomorrow']]

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: false,
      reason: 'No unsent messages found',
    })
  })

  test('should skip message when date is not today (past date)', () => {
    const rows = [[yesterdayStr, '10:00', '', 'Test message for yesterday']]

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: false,
      reason: 'No unsent messages found',
    })
  })

  test('should skip message when time has not arrived yet', () => {
    const futureTime = '23:59'
    const rows = [[todayStr, futureTime, '', 'Test message for later today']]

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: false,
      reason: 'No unsent messages found',
    })
  })

  test('should return message to send when time has passed', () => {
    // Set time to early morning (00:01)
    const pastTime = '00:01'
    const testMessage = 'Good morning message'
    const rows = [[todayStr, pastTime, '', testMessage]]

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: true,
      message: testMessage,
      messageToProcess: {
        rowIndex: 0,
        message: testMessage,
        dateStr: todayStr,
        timeStr: pastTime,
      },
    })
  })

  test('should return first unsent message when multiple unsent messages exist', () => {
    const pastTime = '00:01'
    const firstMessage = 'First message'
    const secondMessage = 'Second message'
    const rows = [
      [todayStr, pastTime, '', firstMessage],
      [todayStr, pastTime, '', secondMessage],
    ]

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: true,
      message: firstMessage,
      messageToProcess: {
        rowIndex: 0,
        message: firstMessage,
        dateStr: todayStr,
        timeStr: pastTime,
      },
    })
  })

  test('should skip sent messages and return first unsent one', () => {
    const pastTime = '00:01'
    const unsentMessage = 'Unsent message'
    const rows = [
      [todayStr, pastTime, 'x', 'Already sent message 1'],
      [todayStr, pastTime, 'sent', 'Already sent message 2'],
      [todayStr, pastTime, '', unsentMessage],
      [todayStr, pastTime, '', 'Another unsent message'],
    ]

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: true,
      message: unsentMessage,
      messageToProcess: {
        rowIndex: 2,
        message: unsentMessage,
        dateStr: todayStr,
        timeStr: pastTime,
      },
    })
  })

  test('should handle mixed scenarios correctly', () => {
    const pastTime = '00:01'
    const futureTime = '23:59'
    const validMessage = 'Valid message'
    const rows = [
      [todayStr, pastTime, 'x', 'Already sent'],
      [yesterdayStr, pastTime, '', 'Wrong date'],
      [todayStr, futureTime, '', 'Wrong time'],
      [todayStr, pastTime, '', ''], // Empty message
      [todayStr, pastTime, '', validMessage],
    ]

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: true,
      message: validMessage,
      messageToProcess: {
        rowIndex: 4,
        message: validMessage,
        dateStr: todayStr,
        timeStr: pastTime,
      },
    })
  })

  test('should handle malformed date formats gracefully', () => {
    const rows = [['invalid-date', '10:00', '', 'Test message']]

    // This should throw an error due to invalid date format
    assert.throws(() => processDailyMessages(rows))
  })

  test('should handle malformed time formats gracefully', () => {
    const rows = [[todayStr, 'invalid-time', '', 'Test message']]

    // This should throw an error due to invalid time format
    assert.throws(() => processDailyMessages(rows))
  })

  test('should handle empty sent column as unsent', () => {
    const pastTime = '00:01'
    const testMessage = 'Test message'
    const rows = [
      [todayStr, pastTime, '', testMessage], // Empty string
      [todayStr, pastTime, '', 'Another message'], // Empty string instead of null
      [todayStr, pastTime, '', 'Third message'], // Empty string instead of undefined
    ]

    assert.partialDeepStrictEqual(processDailyMessages(rows), {
      shouldSend: true,
      message: testMessage,
      messageToProcess: {
        rowIndex: 0,
        message: testMessage,
        dateStr: todayStr,
        timeStr: pastTime,
      },
    })
  })

  test('should handle whitespace-only sent column as unsent', () => {
    const pastTime = '00:01'
    const testMessage = 'Test message'
    const rows = [
      [todayStr, pastTime, '   ', testMessage], // Whitespace only
      [todayStr, pastTime, '\t', 'Another message'], // Tab
      [todayStr, pastTime, '\n', 'Third message'], // Newline
    ]
    const result = processDailyMessages(rows)

    assert.partialDeepStrictEqual(result, {
      shouldSend: true,
      message: testMessage,
      messageToProcess: {
        rowIndex: 0,
        message: testMessage,
        dateStr: todayStr,
        timeStr: pastTime,
      },
    })
  })
})
