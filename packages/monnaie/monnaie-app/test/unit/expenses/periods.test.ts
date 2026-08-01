import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  periodDayCounts,
  periodRanges,
  previousPeriodName,
} from '../../../src/domain/expenses/periods.ts'

describe('periodDayCounts', () => {
  it('should count elapsed days in current periods and all days in previous periods', () => {
    const counts = periodDayCounts(new Date('2026-07-29T12:00:00Z'), 'UTC', new Date(0))

    assert.deepStrictEqual(counts, {
      day: 1,
      week: 4,
      month: 29,
      year: 210,
      previousDay: 1,
      previousWeek: 7,
      previousMonth: 30,
      previousYear: 365,
    })
  })

  it('should count the extra day in a previous leap year', () => {
    const counts = periodDayCounts(new Date('2025-01-01T12:00:00Z'), 'UTC', new Date(0))

    assert.strictEqual(counts.previousYear, 366)
  })

  it('should count each period from the first expense or its calendar boundary', () => {
    const counts = periodDayCounts(
      new Date('2026-07-29T12:00:00Z'),
      'UTC',
      new Date('2026-06-20T18:00:00Z'),
    )

    assert.strictEqual(counts.week, 4)
    assert.strictEqual(counts.month, 29)
    assert.strictEqual(counts.year, 40)
    assert.strictEqual(counts.previousMonth, 11)
  })

  it('should interpret the first expense date in the configured time zone', () => {
    const counts = periodDayCounts(
      new Date('2026-07-29T12:00:00Z'),
      'Asia/Jerusalem',
      new Date('2026-07-19T22:00:00Z'),
    )

    assert.strictEqual(counts.month, 10)
  })
})

describe('periodRanges', () => {
  it('should use local midnight, not UTC midnight', () => {
    // noon UTC on a Wednesday, which in Jerusalem (UTC+3 in the summer) is 15:00 of the same day
    const ranges = periodRanges(new Date('2026-07-29T12:00:00Z'), 'Asia/Jerusalem')

    // asserted on the clock in Jerusalem, because that is what the boundaries are about — the same
    // two instants are 21:00Z of the day before and 21:00Z of the day itself
    assert.deepStrictEqual(wallClockRange(ranges.day, 'Asia/Jerusalem'), [
      '2026-07-29T00:00:00',
      '2026-07-30T00:00:00',
    ])
    assert.deepStrictEqual(wallClockRange(ranges.previousDay, 'Asia/Jerusalem'), [
      '2026-07-28T00:00:00',
      '2026-07-29T00:00:00',
    ])
    assert.deepStrictEqual(isoRange(ranges.day), [
      '2026-07-28T21:00:00.000Z',
      '2026-07-29T21:00:00.000Z',
    ])
  })

  it('should be the plain calendar day in UTC', () => {
    const ranges = periodRanges(new Date('2026-07-29T12:00:00Z'), 'UTC')

    assert.deepStrictEqual(isoRange(ranges.day), [
      '2026-07-29T00:00:00.000Z',
      '2026-07-30T00:00:00.000Z',
    ])
  })

  it('should start the week on the Sunday before the day', () => {
    // 2026-07-29 is a Wednesday
    const ranges = periodRanges(new Date('2026-07-29T12:00:00Z'), 'UTC')

    assert.deepStrictEqual(isoRange(ranges.week), [
      '2026-07-26T00:00:00.000Z',
      '2026-08-02T00:00:00.000Z',
    ])
    assert.deepStrictEqual(isoRange(ranges.previousWeek), [
      '2026-07-19T00:00:00.000Z',
      '2026-07-26T00:00:00.000Z',
    ])
  })

  it('should start the week on the day itself when the day is a Sunday', () => {
    // 2026-07-26 is a Sunday, the very first moment of it
    const ranges = periodRanges(new Date('2026-07-26T00:00:00Z'), 'UTC')

    assert.deepStrictEqual(isoRange(ranges.week), [
      '2026-07-26T00:00:00.000Z',
      '2026-08-02T00:00:00.000Z',
    ])
  })

  it('should keep a Saturday in the week that started the Sunday before it', () => {
    // 2026-08-01 is a Saturday, the last day of the week that began on 2026-07-26
    const ranges = periodRanges(new Date('2026-08-01T23:59:59Z'), 'UTC')

    assert.deepStrictEqual(isoRange(ranges.week), [
      '2026-07-26T00:00:00.000Z',
      '2026-08-02T00:00:00.000Z',
    ])
  })

  it('should follow the length of each month rather than a fixed number of days', () => {
    // May has 31 days, April has 30
    const ranges = periodRanges(new Date('2026-05-15T12:00:00Z'), 'UTC')

    assert.deepStrictEqual(isoRange(ranges.month), [
      '2026-05-01T00:00:00.000Z',
      '2026-06-01T00:00:00.000Z',
    ])
    assert.deepStrictEqual(isoRange(ranges.previousMonth), [
      '2026-04-01T00:00:00.000Z',
      '2026-05-01T00:00:00.000Z',
    ])
  })

  it('should give February its extra day in a leap year', () => {
    const ranges = periodRanges(new Date('2024-02-15T12:00:00Z'), 'UTC')

    assert.deepStrictEqual(isoRange(ranges.month), [
      '2024-02-01T00:00:00.000Z',
      '2024-03-01T00:00:00.000Z',
    ])
  })

  it('should keep the 31st of a month inside that month', () => {
    const ranges = periodRanges(new Date('2026-01-31T12:00:00Z'), 'UTC')

    assert.deepStrictEqual(isoRange(ranges.month), [
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    ])
    // and the month before it is December, not "31 days ago"
    assert.deepStrictEqual(isoRange(ranges.previousMonth), [
      '2025-12-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ])
  })

  it('should roll the year and the previous year over on the 1st of January', () => {
    const ranges = periodRanges(new Date('2026-01-01T00:00:00Z'), 'UTC')

    assert.deepStrictEqual(isoRange(ranges.year), [
      '2026-01-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
    ])
    assert.deepStrictEqual(isoRange(ranges.previousYear), [
      '2025-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ])
  })

  it('should take the year boundary from the winter offset, not the summer one', () => {
    // Jerusalem is UTC+3 in July but UTC+2 on the 1st of January
    const ranges = periodRanges(new Date('2026-07-29T12:00:00Z'), 'Asia/Jerusalem')

    assert.deepStrictEqual(isoRange(ranges.year), [
      '2025-12-31T22:00:00.000Z',
      '2026-12-31T22:00:00.000Z',
    ])
  })

  it('should make the day a DST change shortens shorter, and still whole', () => {
    // Israeli summer time began at 02:00 on 2026-03-27, so that day was 23 hours long
    const ranges = periodRanges(new Date('2026-03-28T12:00:00Z'), 'Asia/Jerusalem')

    assert.deepStrictEqual(isoRange(ranges.previousDay), [
      '2026-03-26T22:00:00.000Z',
      '2026-03-27T21:00:00.000Z',
    ])
    assert.strictEqual(hoursIn(ranges.previousDay), 23)
    // and today, entirely inside summer time, is a normal day
    assert.strictEqual(hoursIn(ranges.day), 24)
  })

  it('should make the day a DST change lengthens longer', () => {
    // Israeli summer time ended at 02:00 on 2026-10-25, so that day was 25 hours long
    const ranges = periodRanges(new Date('2026-10-25T12:00:00Z'), 'Asia/Jerusalem')

    assert.strictEqual(hoursIn(ranges.day), 25)
  })

  it('should leave no gap and no overlap between a period and the one before it', () => {
    const ranges = periodRanges(new Date('2026-03-28T12:00:00Z'), 'Asia/Jerusalem')

    for (const period of ['day', 'week', 'month', 'year'] as const) {
      assert.strictEqual(
        ranges[previousPeriodName(period)].to.getTime(),
        ranges[period].from.getTime(),
        `the previous ${period} should end exactly where the ${period} starts`,
      )
    }
  })
})

function isoRange({from, to}: {from: Date; to: Date}): string[] {
  return [from.toISOString(), to.toISOString()]
}

/**
 * `Date.toISOString` always prints UTC, which hides the whole point of a boundary that belongs to a
 * timezone. This prints the same two instants as they read on the clock there.
 */
function wallClockRange({from, to}: {from: Date; to: Date}, timeZone: string): string[] {
  return [from, to].map((date) =>
    Temporal.Instant.fromEpochMilliseconds(date.getTime())
      .toZonedDateTimeISO(timeZone)
      .toPlainDateTime()
      .toString(),
  )
}

function hoursIn({from, to}: {from: Date; to: Date}): number {
  return (to.getTime() - from.getTime()) / (60 * 60 * 1000)
}
