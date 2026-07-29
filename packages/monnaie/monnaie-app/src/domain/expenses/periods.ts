/**
 * The calendar arithmetic behind the summary, kept pure and away from both the database and the
 * views. It is done here, in `Temporal`, rather than in SQL, because that makes it something a unit
 * test can pin down — a DST day, a leap year, the 31st of a month — and leaves the queries with
 * nothing but bound `Date` parameters.
 */

/** The four periods the app knows about, in the order the summary shows them */
export const BASE_PERIOD_NAMES = ['day', 'week', 'month', 'year'] as const

export type BasePeriodName = (typeof BASE_PERIOD_NAMES)[number]

export type PreviousPeriodName = `previous${Capitalize<BasePeriodName>}`

export type PeriodName = BasePeriodName | PreviousPeriodName

const PREVIOUS_PERIOD_NAMES = {
  day: 'previousDay',
  week: 'previousWeek',
  month: 'previousMonth',
  year: 'previousYear',
} as const satisfies Record<BasePeriodName, PreviousPeriodName>

export function previousPeriodName(name: BasePeriodName): PreviousPeriodName {
  return PREVIOUS_PERIOD_NAMES[name]
}

/** Half-open: `from` is included, `to` is not, so consecutive periods never double-count */
export type PeriodRange = {from: Date; to: Date}

export type PeriodRanges = Record<PeriodName, PeriodRange>

/**
 * The eight ranges the summary is made of, as of `now` and as seen from `timeZone`. Periods are
 * calendar periods — "today", "this month" — and the week starts on Sunday.
 */
export function periodRanges(now: Date, timeZone: string): PeriodRanges {
  const zoned = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(timeZone)

  const day = zoned.startOfDay()
  // ISO weekdays run Monday=1 … Sunday=7, so `% 7` is how many days back the Sunday is
  const week = startOfDay(day.subtract({days: zoned.dayOfWeek % 7}))
  const month = zoned.with({day: 1}).startOfDay()
  const year = zoned.with({month: 1, day: 1}).startOfDay()

  return {
    day: rangeStartingAt(day, {days: 1}),
    week: rangeStartingAt(week, {weeks: 1}),
    month: rangeStartingAt(month, {months: 1}),
    year: rangeStartingAt(year, {years: 1}),
    previousDay: rangeEndingAt(day, {days: 1}),
    previousWeek: rangeEndingAt(week, {weeks: 1}),
    previousMonth: rangeEndingAt(month, {months: 1}),
    previousYear: rangeEndingAt(year, {years: 1}),
  }
}

function rangeStartingAt(from: Temporal.ZonedDateTime, length: Temporal.DurationLike): PeriodRange {
  return {from: toDate(from), to: toDate(startOfDay(from.add(length)))}
}

function rangeEndingAt(to: Temporal.ZonedDateTime, length: Temporal.DurationLike): PeriodRange {
  return {from: toDate(startOfDay(to.subtract(length))), to: toDate(to)}
}

/**
 * Every boundary here is a local midnight, and adding or subtracting a duration lands on the same
 * wall-clock time rather than on the start of the day — which is not the same thing on the days
 * when midnight itself is skipped by a DST change.
 */
function startOfDay(zoned: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return zoned.startOfDay()
}

function toDate(zoned: Temporal.ZonedDateTime): Date {
  return new Date(zoned.toInstant().epochMilliseconds)
}
