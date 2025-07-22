import {test, describe} from 'node:test'
import assert from 'node:assert'
import {Temporal} from 'temporal-polyfill'
import {findNextMessageToSend} from '../src/find-next-message-to-send.ts'

describe('processDailyMessages', () => {
  const todayStr = Temporal.Now.zonedDateTimeISO('Asia/Jerusalem')
    .toPlainDate()
    .toLocaleString('he-IL')
    .replaceAll('.', '/')
  const tomorrowStr = Temporal.Now.zonedDateTimeISO('Asia/Jerusalem')
    .add({days: 1})
    .toPlainDate()
    .toLocaleString('he-IL')
  const yesterdayStr = Temporal.Now.zonedDateTimeISO('Asia/Jerusalem')
    .subtract({days: 1})
    .toPlainDate()
    .toLocaleString('he-IL')
  const dayBeforeYesterdayStr = Temporal.Now.zonedDateTimeISO('Asia/Jerusalem')
    .subtract({days: 2})
    .toPlainDate()
    .toLocaleString('he-IL')

  test('should return no unsent messages when all rows are empty', () => {
    const rows: string[][] = []

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: false,
      reason: 'No unsent messages found',
    })
  })

  test('should return no unsent messages when all messages are already sent', () => {
    const rows = [
      [todayStr, '10:00', 'x', 'Test message 1'],
      [todayStr, '11:00', 'sent', 'Test message 2'],
      [todayStr, '12:00', 'y', 'Test message 3'],
    ]

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: false,
      reason: 'No unsent messages found',
    })
  })

  test('should return no unsent messages when all messages are empty', () => {
    const rows = [
      [todayStr, '10:00', '', ''],
      [todayStr, '11:00', '', '   '],
      [todayStr, '12:00', '', ''],
    ]

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: false,
      reason: 'No unsent messages found',
    })
  })

  test('should skip message when date is not today (future date)', () => {
    const rows = [[tomorrowStr, '10:00', '', 'Test message for tomorrow']]

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: false,
      reason: 'No unsent messages found',
    })
  })

  test('should skip message when date is not today (past date)', () => {
    const rows = [[yesterdayStr, '10:00', '', 'Test message for yesterday']]

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: false,
      reason: 'No unsent messages found',
    })
  })

  test('should skip message when time has not arrived yet', () => {
    const futureTime = '23:59'
    const rows = [[todayStr, futureTime, '', 'Test message for later today']]

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: false,
      reason: 'No unsent messages found',
    })
  })

  test('should return message to send when time has passed', () => {
    // Set time to early morning (00:01)
    const pastTime = '00:01'
    const testMessage = 'Good morning message'
    const rows = [[todayStr, pastTime, '', testMessage]]

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: true,
      rowIndex: 0,
      message: testMessage,
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

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: true,
      rowIndex: 0,
      message: firstMessage,
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

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: true,
      rowIndex: 2,
      message: unsentMessage,
    })
  })

  test('should handle regular scenario', () => {
    const pastTime = '00:01'
    const testMessage = 'Regular message'
    const rows = [
      [dayBeforeYesterdayStr, '05:00', 'x', 'a message'],
      [yesterdayStr, '05:00', 'x', 'another message'],
      [todayStr, pastTime, '', testMessage], // This is the message we want
      [tomorrowStr, pastTime, '', 'yet another message'], // Not this one
    ]

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: true,
      rowIndex: 2,
      message: testMessage,
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

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: true,
      rowIndex: 4,
      message: validMessage,
    })
  })

  test('should handle malformed date formats gracefully', () => {
    const rows = [['invalid-date', '10:00', '', 'Test message']]

    // This should throw an error due to invalid date format
    assert.throws(() => findNextMessageToSend(rows))
  })

  test('should handle malformed time formats gracefully', () => {
    const rows = [[todayStr, 'invalid-time', '', 'Test message']]

    // This should throw an error due to invalid time format
    assert.throws(() => findNextMessageToSend(rows))
  })

  test('should handle empty sent column as unsent', () => {
    const pastTime = '00:01'
    const testMessage = 'Test message'
    const rows = [
      [todayStr, pastTime, '', testMessage], // Empty string
      [todayStr, pastTime, '', 'Another message'], // Empty string instead of null
      [todayStr, pastTime, '', 'Third message'], // Empty string instead of undefined
    ]

    assert.partialDeepStrictEqual(findNextMessageToSend(rows), {
      found: true,
      rowIndex: 0,
      message: testMessage,
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
    const result = findNextMessageToSend(rows)

    assert.partialDeepStrictEqual(result, {
      found: true,
      rowIndex: 0,
      message: testMessage,
    })
  })
})
