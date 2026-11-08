import {expect, test, type Page} from '@playwright/test'
import {
  createCommunityMemberPageModel,
  createCommunityMembersPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/community-member.model'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-email/testkit/page-model/email.model'
import {createNewCommunityMemberPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-member-page.model'
import {createUpdateCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/update-community-page.model'
import {createUpdateStudentPageModel} from '@giltayar/carmbo-pages-student/testkit/page-model/update-student-page.model'
import {addMember, DEFAULT_MEMBER_ROLES} from '../../../src/member-model.ts'
import {setup} from '../common/setup.ts'
import {createMemberFixture} from '../common/member-fixture.ts'
import {createApp} from '../../../start/app.ts'
import {TEST_resetJobHandlers} from '@giltayar/carmbo-pages-job/testkit'

let now = new Date('2026-11-07T10:00:00Z')
const {sql, url, emailService, registrationEmail, executeJobs, TEST_hooks} = setup(
  import.meta.url,
  {
    nowService: () => now,
  },
)

test.beforeEach(() => {
  now = new Date('2026-11-07T10:00:00Z')
})

async function enqueue() {
  const fixture = await createMemberFixture(sql(), now, 'Alice', 'alice@example.com')
  await addMember(
    fixture.communityNumber,
    fixture.studentNumber,
    now,
    sql(),
    DEFAULT_MEMBER_ROLES,
    registrationEmail(),
  )
  return fixture
}

async function openEmail(page: Page) {
  await page.goto(new URL('/emails', url()).href)
  await createEmailListPageModel(page).rows().row(0).number().locator.click()
  return createEmailPageModel(page)
}

async function openMember(page: Page, base: string) {
  await page.goto(new URL(base, url()).href)
  return createCommunityMemberPageModel(page)
}

async function openJob(page: Page) {
  const jobId = await createEmailPageModel(page).details().field('Job ID').locator.innerText()
  await page.goto(new URL(`/jobs/${jobId}`, url()).href)
  return page.getByRole('heading', {level: 2})
}

test('adding a member through the UI sends a registration email and records both histories', async ({
  page,
}) => {
  const {communityNumber, studentNumber, base} = await createMemberFixture(
    sql(),
    now,
    'Alice',
    'alice@example.com',
  )
  const form = createNewCommunityMemberPageModel(page)
  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)
  await form.student().locator.fill(`${studentNumber}: Alice Student`)
  await form.roles().checkbox('Moderator').locator.check()
  await form.submit().locator.click()
  await expect(page).toHaveURL(new URL(base, url()).href)

  const memberPage = createCommunityMemberPageModel(page)
  await expect(memberPage.state().field('Status').locator).toHaveText('Registration email sent', {
    timeout: 10_000,
  })
  await expect(memberPage.history().items().locator).toHaveCount(2)
  await expect(memberPage.roles().checkbox('Moderator').locator).toBeChecked()
  await memberPage.history().link('Added').locator.click()
  await expect(memberPage.historical().locator).toBeVisible()
  await expect(memberPage.state().field('Status').locator).toHaveText('Started registration')
  await expect(memberPage.state().field('Registration email sent at').locator).toHaveCount(0)

  const email = await openEmail(page)
  await expect(email.details().field('Recipient').locator).toHaveText('alice@example.com')
  await expect(email.details().field('Community').link().locator).toHaveAttribute(
    'href',
    `/communities/${communityNumber}`,
  )
  await expect(email.details().field('Member').link().locator).toHaveAttribute('href', base)
  await expect(email.details().field('Subject').locator).toHaveText('Welcome to Community')
  await expect(email.preview().body().locator).toContainText('Alice Student')
  await expect(email.plainText().locator).toContainText('Community')
  await expect(email.details().field('Delivery confirmed').timestamps().locator).toHaveCount(0)
  await expect(email.details().field('Accepted by Resend').timestamps().locator).toHaveAttribute(
    'datetime',
    now.toISOString(),
  )
  await expect(email.details().field('Sending attempts').timestamps().locator).toHaveAttribute(
    'datetime',
    now.toISOString(),
  )
  await expect(email.details().field('Retries').timestamps().locator).toHaveCount(0)
  expect(emailService().sentEmails).toHaveLength(1)
  const tags = JSON.parse(await email.details().field('Tags').locator.innerText())
  expect(Object.keys(tags).sort()).toEqual(['carmbo_email_id', 'job_id'])
  expect(emailService().attempts[0].message.tags).toEqual(tags)
  expect(emailService().attempts[0].options.idempotencyKey).toBe(
    `registration-email/${tags.carmbo_email_id}`,
  )
})

test('creation commits the member, email, link and job together and sends only after commit', async ({
  page,
}) => {
  const {base} = await enqueue()
  const member = await openMember(page, base)
  await expect(member.state().field('Status').locator).toHaveText('Started registration')
  const email = await openEmail(page)
  await expect(email.details().field('Member').link().locator).toHaveAttribute('href', base)
  await expect(email.details().field('Status').locator).toHaveText('Sending')
  const job = await openJob(page)
  await expect(job).toContainText('Send email (communityNumber: ')
  await expect(page.getByText('Finished: still working...', {exact: true})).toBeVisible()
  expect(emailService().attempts).toHaveLength(0)
  await executeJobs()
  expect(emailService().sentEmails).toHaveLength(1)
  await executeJobs()
  expect(emailService().attempts).toHaveLength(1)
})

test('failure rolls back all membership, email and job writes', async ({page}) => {
  const {communityNumber, studentNumber} = await createMemberFixture(
    sql(),
    now,
    'Alice',
    'alice@example.com',
  )
  TEST_hooks.createRegistrationEmail = async () => {
    throw new Error('Cannot save registration email')
  }
  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)
  const form = createNewCommunityMemberPageModel(page)
  await form.student().locator.fill(`${studentNumber}: Alice Student`)
  await form.submit().locator.click()
  await expect(form.error().locator).toContainText('Cannot save registration email')
  await page.goto(new URL(`/communities/${communityNumber}/members`, url()).href)
  await expect(createCommunityMembersPageModel(page).list().rows().locator).toHaveCount(0)
  await page.goto(new URL('/emails', url()).href)
  await expect(createEmailListPageModel(page).rows().locator).toHaveCount(0)
  await expect(createEmailListPageModel(page).empty().locator).toBeVisible()
  await page.goto(new URL('/jobs', url()).href)
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(0)
  // Orphan snapshots have no UI entry point.
  const [snapshots] = await sql()<{count: number}[]>`
    SELECT (SELECT count(*) FROM community_member_data)::integer +
      (SELECT count(*) FROM community_member_history)::integer AS count
  `
  expect(snapshots.count).toBe(0)
  expect(emailService().attempts).toHaveLength(0)
})

test('retries keep the exact saved payload and key after edits, with eventual acceptance', async ({
  page,
}) => {
  const {communityNumber, studentNumber, base} = await enqueue()
  emailService().failNextSend(new Error('Temporary provider failure'))
  await executeJobs()
  const email = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Retrying')
  await expect(email.details().field('Error').locator).toHaveText('Temporary provider failure')
  await expect(email.details().field('Sending attempts').timestamps().locator).toHaveCount(1)
  await expect(email.details().field('Retries').timestamps().locator).toHaveCount(0)
  const member = await openMember(page, base)
  await expect(member.history().items().locator).toHaveCount(1)

  await page.goto(new URL(`/communities/${communityNumber}`, url()).href)
  const community = createUpdateCommunityPageModel(page)
  await community.form().nameInput().locator.fill('Changed')
  await community.form().updateButton().locator.click()
  await expect(community.history().items().locator).toHaveCount(2)
  await page.goto(new URL(`/students/${studentNumber}`, url()).href)
  const student = createUpdateStudentPageModel(page)
  await student.form().names().firstNameInput(0).locator.fill('Changed student')
  await student.form().updateButton().locator.click()
  await expect(student.history().items().locator).toHaveCount(2)

  now = new Date(now.getTime() + 1000)
  await executeJobs()
  await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
  await expect(email.details().field('Error').locator).toHaveText('-')
  await expect(email.details().field('Retries').timestamps().locator).toHaveAttribute(
    'datetime',
    now.toISOString(),
  )
  await expect(email.details().field('Sending attempts').timestamps().locator).toHaveCount(2)
  expect(emailService().attempts[1].message).toEqual(emailService().attempts[0].message)
  expect(emailService().attempts[1].options).toEqual(emailService().attempts[0].options)
  await expect(email.preview().body().locator).toContainText('Alice Student')
  await expect(email.preview().body().locator).not.toContainText('Changed')
})

test('four failed attempts exhaust the job and preserve error diagnostics in the member history', async ({
  page,
}) => {
  const {base} = await enqueue()
  for (let attempt = 0; attempt < 4; attempt++) {
    emailService().failNextSend(new Error(`Provider failure ${attempt}`))
    await executeJobs()
    now = new Date(now.getTime() + 1000)
  }
  const email = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Failure')
  await expect(email.details().field('Sending attempts').timestamps().locator).toHaveCount(4)
  await expect(email.details().field('Retries').timestamps().locator).toHaveCount(3)
  const job = await openJob(page)
  await expect(job).toContainText('Provider failure 3')
  await expect(page.getByText(/^Finished:/)).not.toContainText('still working...')
  const member = await openMember(page, base)
  await expect(member.state().field('Status').locator).toHaveText('Registration failed')
  await expect(member.state().field('Reason').locator).toHaveText('Email sending failed')
  await expect(member.state().field('Reason / error text').locator).toHaveText('Provider failure 3')
  await expect(member.state().field('Registration email sent at').locator).toHaveCount(0)
  await expect(member.history().items().locator).toHaveCount(2)
  await executeJobs()
  expect(emailService().attempts).toHaveLength(4)
})

test('role edits survive completion and cancellations and re-adds are not overwritten', async ({
  page,
}) => {
  const fixture = await enqueue()
  const member = await openMember(page, fixture.base)
  await member.roles().checkbox('Moderator').locator.check()
  await member.roles().save().locator.click()
  await expect(member.history().items().locator).toHaveCount(2)
  await executeJobs()
  await expect(member.state().field('Status').locator).toHaveText('Registration email sent')
  await expect(member.roles().checkbox('Moderator').locator).toBeChecked()

  const second = await createMemberFixture(sql(), now, 'Bob', 'bob@example.com')
  await addMember(
    second.communityNumber,
    second.studentNumber,
    now,
    sql(),
    DEFAULT_MEMBER_ROLES,
    registrationEmail(),
  )
  await openMember(page, second.base)
  await member.actions().button('Cancel registration').locator.click()
  await expect(member.state().field('Status').locator).toHaveText('Cancelled')
  await executeJobs()
  await page.reload()
  await expect(member.state().field('Status').locator).toHaveText('Cancelled')
  await member.actions().button('Re-add member').locator.click()
  await expect(member.state().field('Status').locator).toHaveText('Registered')
  await expect(member.state().field('Registration email sent at').locator).toHaveCount(0)
  await executeJobs()
  expect(emailService().sentEmails).toHaveLength(2)
  await page.goto(new URL('/emails', url()).href)
  await expect(createEmailListPageModel(page).rows().locator).toHaveCount(2)
})

test('duplicate adds and archived communities cannot create another email or overwrite member state', async ({
  page,
}) => {
  const {communityNumber, studentNumber, base} = await enqueue()
  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)
  const form = createNewCommunityMemberPageModel(page)
  await form.student().locator.fill(`${studentNumber}: Alice Student`)
  await form.submit().locator.click()
  await expect(form.error().locator).toContainText('already has a membership')
  await page.goto(new URL('/emails', url()).href)
  await expect(createEmailListPageModel(page).rows().locator).toHaveCount(1)
  await page.goto(new URL(`/communities/${communityNumber}`, url()).href)
  const community = createUpdateCommunityPageModel(page)
  await community.form().deleteButton().locator.click()
  await expect(community.pageTitle().locator).toContainText('(archived)')
  await executeJobs()
  const member = await openMember(page, base)
  await expect(member.state().field('Status').locator).toHaveText('Started registration')
  const email = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
})

test('a database failure after provider acceptance retries the identical request without duplicate sends', async ({
  page,
}) => {
  const {communityNumber, studentNumber, base} = await createMemberFixture(
    sql(),
    now,
    'Alice',
    'alice@example.com',
  )
  let snapshots = 0
  TEST_hooks.writeMemberSnapshot = async () => {
    if (++snapshots > 1) throw new Error('Member result write failed')
  }
  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)
  const form = createNewCommunityMemberPageModel(page)
  await form.student().locator.fill(`${studentNumber}: Alice Student`)
  await form.submit().locator.click()
  await expect(page).toHaveURL(new URL(base, url()).href)
  const email = await openEmail(page)
  await openJob(page)
  await expect
    .poll(async () => {
      await page.reload()
      return page.getByRole('heading', {level: 2}).innerText()
    })
    .toContain('Member result write failed')
  expect(emailService().sentEmails).toHaveLength(1)
  await openEmail(page)
  await expect(email.details().field('Resend email ID').locator).toHaveText('-')
  const member = await openMember(page, base)
  await expect(member.state().field('Status').locator).toHaveText('Started registration')
  delete TEST_hooks.writeMemberSnapshot
  await executeJobs()
  expect(emailService().sentEmails).toHaveLength(1)
  expect(emailService().attempts).toHaveLength(2)
  await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
  await openMember(page, base)
  await expect(member.state().field('Status').locator).toHaveText('Registration email sent')
})

test('the last allowed attempt may succeed without adding a failure snapshot', async ({page}) => {
  const {base} = await enqueue()
  for (let index = 0; index < 3; index++) {
    emailService().failNextSend(new Error('Temporary failure'))
    await executeJobs()
  }
  await executeJobs()
  const email = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
  const member = await openMember(page, base)
  await expect(member.state().field('Status').locator).toHaveText('Registration email sent')
  await expect(member.history().items().locator).toHaveCount(2)
  await expect(member.history().link('Registration failed').locator).toHaveCount(0)
})

for (const [action, status] of [
  ['Cancel registration', 'Cancelled'],
  ['Block member', 'Unregistered'],
  ['Mark registered', 'Registered'],
] as const) {
  test(`final failure does not overwrite an intervening ${action} action`, async ({page}) => {
    const {base} = await enqueue()
    const member = await openMember(page, base)
    await member.actions().reason().locator.fill('User decision')
    await member.actions().button(action).locator.click()
    await expect(member.state().field('Status').locator).toHaveText(status)
    for (let index = 0; index < 4; index++) {
      emailService().failNextSend(new Error('Provider failure'))
      await executeJobs()
    }
    await page.reload()
    await expect(member.state().field('Status').locator).toHaveText(status)
    await expect(member.state().field('Reason / error text').locator).toHaveText('User decision')
    await expect(member.history().items().locator).toHaveCount(2)
    const email = await openEmail(page)
    await expect(email.details().field('Status').locator).toHaveText('Failure')
  })
}

test('the standalone host registers handlers and executes persisted jobs after restart', async ({
  page,
}) => {
  const {base} = await enqueue()
  TEST_resetJobHandlers()
  const app = await createApp(sql(), {
    emailService: emailService(),
    from: 'sender@example.com',
    webhookSigningSecret: `whsec_${Buffer.from('standalone-test-signing-secret!!').toString('base64')}`,
  })
  try {
    const address = await app.listen({host: '127.0.0.1', port: 0})
    await page.goto(`${address}${base}`)
    const member = createCommunityMemberPageModel(page)
    await expect(member.state().field('Status').locator).toHaveText('Registration email sent', {
      timeout: 10_000,
    })
    expect(emailService().sentEmails).toHaveLength(1)
  } finally {
    await app.close()
  }
})
