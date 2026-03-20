import {test, expect} from '@playwright/test'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {setup} from '../common/setup.ts'
import {createStudent, type NewStudent} from '../../../src/domain/student/model.ts'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {Sql} from 'postgres'

const {url, sql, smooveIntegration} = setup(import.meta.url)

test('searching students', async ({page}) => {
  test.slow()

  const {notableNumbers} = await seedStudents(sql(), smooveIntegration())

  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  // --- Pagination: first page loads 50 (descending order: highest student numbers first) ---
  await expect(studentListModel.list().rows().locator).toHaveCount(50)

  // First row is the last-created student (Fill143, student 200)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('200')
  await expect(studentListModel.list().rows().row(0).nameCell().locator).toHaveText(
    'Fill143 Pad143',
  )

  // Scroll to row 49 to trigger loading page 2
  await expect(studentListModel.list().rows().row(49).idLink().locator).toHaveText('151')
  await studentListModel.list().rows().locator.nth(49).scrollIntoViewIfNeeded()
  await expect(studentListModel.list().rows().row(49).emailCell().locator).toHaveText(
    'fill094@fill.dev',
  )

  // --- Pagination: after scroll, 100 rows ---
  await expect(studentListModel.list().rows().locator).toHaveCount(100)

  // First row still there after more rows loaded
  await expect(studentListModel.list().rows().row(0).nameCell().locator).toHaveText(
    'Fill143 Pad143',
  )

  // Check a row in the second page (row 60 = student 140 = Fill083)
  await studentListModel.list().rows().locator.nth(60).scrollIntoViewIfNeeded()
  await expect(studentListModel.list().rows().row(60).phoneCell().locator).toHaveText('9990830000')

  // --- Pagination: scroll to load all 200 ---
  await studentListModel.list().rows().locator.nth(99).scrollIntoViewIfNeeded()
  await expect(studentListModel.list().rows().locator).toHaveCount(150)

  await studentListModel.list().rows().locator.nth(149).scrollIntoViewIfNeeded()
  await expect(studentListModel.list().rows().locator).toHaveCount(200)

  // Scrolling past the end doesn't create more rows
  await studentListModel.list().rows().locator.nth(199).scrollIntoViewIfNeeded()
  await expect(studentListModel.list().rows().locator).toHaveCount(200)

  // --- Search by name: "Zara" → 3 hits (2 visible in name, 1 via facebook name), descending ---
  await studentListModel.search().queryInput().locator.fill('Zara')

  await expect(studentListModel.list().rows().locator).toHaveCount(3)
  // Descending: student 3 (Roni Avital, facebook match) first
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText(
    String(notableNumbers[2]),
  )
  // Then student 2 (Zara Okonkwo)
  await expect(studentListModel.list().rows().row(1).idLink().locator).toHaveText(
    String(notableNumbers[1]),
  )
  await expect(studentListModel.list().rows().row(1).nameCell().locator).toContainText('Zara')
  // Then student 1 (Zara Nakamura)
  await expect(studentListModel.list().rows().row(2).idLink().locator).toHaveText(
    String(notableNumbers[0]),
  )
  await expect(studentListModel.list().rows().row(2).nameCell().locator).toContainText('Zara')

  // --- Search by email domain: "uniquedomain" → 1 hit ---
  await studentListModel.search().queryInput().locator.fill('uniquedomain')

  await expect(studentListModel.list().rows().locator).toHaveCount(1)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText(
    String(notableNumbers[3]),
  )
  await expect(studentListModel.list().rows().row(0).emailCell().locator).toContainText(
    'uniquedomain',
  )

  // --- Substring search: "st" → notables + "Stub" fillers = 52 results ---
  await page.goto(new URL('/students', url()).href)

  await studentListModel.search().queryInput().locator.fill('st')

  const stTotalCount = NOTABLE_ST_NUMBERS.length + ST_FILLER_COUNT
  await expect(studentListModel.list().rows().locator).toHaveCount(50)

  // Descending: first "st" hit is Stub050 (student 57), then Stub049, etc.
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('57')
  await expect(studentListModel.list().rows().row(0).nameCell().locator).toContainText('Stub050')

  // Scroll to load the remaining "st" results
  await studentListModel.list().rows().locator.nth(49).scrollIntoViewIfNeeded()
  await expect(studentListModel.list().rows().locator).toHaveCount(stTotalCount)

  // --- Archive / restore ---
  // Archive notable student #1 (Zara Nakamura)
  await page.goto(url().href + `students/${notableNumbers[0]}`)

  await updateStudentModel.form().deleteButton().locator.click()
  await expect(updateStudentModel.form().restoreButton().locator).toBeVisible()

  // Search "Zara" — archived student is excluded, so 2 results instead of 3
  await page.goto(new URL('/students', url()).href)

  await studentListModel.search().queryInput().locator.fill('Zara')

  await expect(studentListModel.list().rows().locator).toHaveCount(2)
  // Descending: student 3 (Roni) first, then student 2 (Zara Okonkwo)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText(
    String(notableNumbers[2]),
  )

  // Check "show archived" — archived student reappears, back to 3 results
  await studentListModel.search().showArchivedCheckbox().locator.check()
  await expect(studentListModel.list().rows().locator).toHaveCount(3)
  // Descending: student 3 first, archived student 1 last
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText(
    String(notableNumbers[2]),
  )
})

/**
 * Seeds the database with notable students first, then filler students.
 * Returns the student numbers so tests can reference them.
 */
async function seedStudents(
  sql: Sql,
  smooveIntegration: SmooveIntegrationService | undefined,
): Promise<{notableNumbers: number[]}> {
  const notableNumbers: number[] = []

  for (const {student} of NOTABLE_STUDENTS) {
    const num = await createStudent(student, undefined, smooveIntegration, new Date(), sql)
    notableNumbers.push(num)
  }

  // "st"-matching fillers: name contains "st" so they show up in substring search for "st"
  for (let i = 1; i <= ST_FILLER_COUNT; i++) {
    const padded = String(i).padStart(3, '0')
    await createStudent(
      {
        names: [{firstName: `Stub${padded}`, lastName: `Pad${padded}`}],
        emails: [`stub${padded}@fill.dev`],
        phones: [`000${padded}0000`],
      },
      undefined,
      smooveIntegration,
      new Date(),
      sql,
    )
  }

  // Plain fillers: no "st", no "Zara", no "uniquedomain" — won't match any search terms
  for (let i = 1; i <= PLAIN_FILLER_COUNT; i++) {
    const padded = String(i).padStart(3, '0')
    await createStudent(
      {
        names: [{firstName: `Fill${padded}`, lastName: `Pad${padded}`}],
        emails: [`fill${padded}@fill.dev`],
        phones: [`999${padded}0000`],
      },
      undefined,
      smooveIntegration,
      new Date(),
      sql,
    )
  }

  return {notableNumbers}
}

/**
 * Notable students with carefully chosen data for search/content assertions.
 * Each serves a specific test purpose. They are created first, so they get the lowest student numbers.
 *
 * IMPORTANT: none of the filler students (names like "Fill-NNN Pad-NNN") contain the search terms
 * used below ("Zara", "uniquedomain", "9876543210") — so search hit counts depend only on these notables
 * plus the "Stub-NNN" fillers (which contain "st" for substring search testing).
 */
const NOTABLE_STUDENTS: {purpose: string; student: NewStudent}[] = [
  {
    purpose: 'name search target #1 + archive/restore target',
    student: {
      names: [{firstName: 'Zara', lastName: 'Nakamura'}],
      emails: ['zara@example.com'],
      phones: ['1111111111'],
    },
  },
  {
    purpose: 'name search target #2 (second visible "Zara")',
    student: {
      names: [{firstName: 'Zara', lastName: 'Okonkwo'}],
      emails: ['zara2@example.com'],
      phones: ['2222222222'],
    },
  },
  {
    purpose: 'name search target #3 — "Zara" only in facebook name, not visible in grid',
    student: {
      names: [{firstName: 'Roni', lastName: 'Avital'}],
      emails: ['roni@example.com'],
      facebookNames: ['Zara Roni'],
      phones: ['3333333333'],
    },
  },
  {
    purpose: 'email domain search target',
    student: {
      names: [{firstName: 'Liam', lastName: 'Berger'}],
      emails: ['liam@uniquedomain.org'],
      phones: ['4444444444'],
    },
  },
  {
    purpose: 'content check — multi-name student',
    student: {
      names: [
        {firstName: 'Amir', lastName: 'Cohen'},
        {firstName: 'Dina', lastName: 'Levy'},
      ],
      emails: ['amir@example.com', 'dina@example.com'],
      phones: ['5555555555', '6666666666'],
    },
  },
  {
    purpose: '"st" substring match — in first name',
    student: {
      names: [{firstName: 'Kristen', lastName: 'Meyer'}],
      emails: ['kristen@example.com'],
      phones: ['7777777777'],
    },
  },
  {
    purpose: '"st" substring match — in last name',
    student: {
      names: [{firstName: 'Leo', lastName: 'Foster'}],
      emails: ['leo@example.com'],
      phones: ['8888888888'],
    },
  },
]

// Student numbers of notables where "st" appears in their searchable text
const NOTABLE_ST_NUMBERS = [6, 7] // Kristen (6) and Foster (7)
const ST_FILLER_COUNT = 50
const TOTAL_STUDENTS = 200
const PLAIN_FILLER_COUNT = TOTAL_STUDENTS - NOTABLE_STUDENTS.length - ST_FILLER_COUNT
