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

export type PeriodDayCounts = Record<PeriodName, number>

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

/** Calendar days represented by each total; current periods include today. */
export function periodDayCounts(
  now: Date,
  timeZone: string,
  firstExpenseDate: Date,
): PeriodDayCounts {
  const day = Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
  const week = day.subtract({days: day.dayOfWeek % 7})
  const previousMonth = day.with({day: 1}).subtract({months: 1})
  const previousYear = day.with({month: 1, day: 1}).subtract({years: 1})
  const periodEndDates: Record<PeriodName, Temporal.PlainDate> = {
    day,
    week: day,
    month: day,
    year: day,
    previousDay: day.subtract({days: 1}),
    previousWeek: week.subtract({days: 1}),
    previousMonth: previousMonth.with({day: previousMonth.daysInMonth}),
    previousYear: previousYear.with({month: 12, day: 31}),
  }

  const calendarCounts: PeriodDayCounts = {
    day: 1,
    week: day.since(week).days + 1,
    month: day.day,
    year: day.dayOfYear,
    previousDay: 1,
    previousWeek: 7,
    previousMonth: previousMonth.daysInMonth,
    previousYear: previousYear.daysInYear,
  }

  return Object.fromEntries(
    Object.entries(calendarCounts).map(([name, calendarCount]) => {
      const periodName = name as PeriodName

      return [
        periodName,
        Math.max(
          1,
          Math.min(
            calendarCount,
            periodEndDates[periodName].since(toPlainDate(firstExpenseDate, timeZone)).days + 1,
          ),
        ),
      ]
    }),
  ) as PeriodDayCounts
}

function toPlainDate(date: Date, timeZone: string): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
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

/** Converts a Date to a `YYYY-MM-DD` string as seen in `timeZone` */
export function timestampToDateString(date: Date, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString()
}

/** Converts a `YYYY-MM-DD` string to a Date at the start of that day in `timeZone` */
export function dateStringToTimestamp(dateString: string, timeZone: string): Date {
  const plain = Temporal.PlainDate.from(dateString)
  const zoned = plain.toZonedDateTime(timeZone)
  return toDate(zoned)
}
