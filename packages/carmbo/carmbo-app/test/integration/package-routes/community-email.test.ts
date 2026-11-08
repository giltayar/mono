import {createHmac, randomUUID} from 'node:crypto'
import {expect, test} from '@playwright/test'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'
import {createCommunityListPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/community-list-page.model'
import {
  createCommunityMemberPageModel,
  createCommunityMembersPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/community-member.model'
import {createEmailPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/email.model'
import {createNewCommunityMemberPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-member-page.model'
import {createNewCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-page.model'
import {setup} from '../common/setup.ts'

const {url, emailService, webhookSigningSecret} = setup(import.meta.url, {withCommunities: true})

// Signs like Resend (Svix): v1,base64(HMAC-SHA256(secret, "<id>.<timestamp>.<body>")).
function resendHeaders(body: string) {
  const id = `msg_${randomUUID()}`
  const timestamp = String(Math.floor(Date.now() / 1000))
  const key = Buffer.from(webhookSigningSecret.replace(/^whsec_/, ''), 'base64')
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
  return {
    'content-type': 'application/json',
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
  }
}

test('adding a community member sends a registration email that a signed callback confirms', async ({
  page,
  request,
}) => {
  await page.goto(new URL('/communities', url()).href)
  await createCommunityListPageModel(page).createNewCommunityButton().locator.click()
  const newCommunity = createNewCommunityPageModel(page)
  await newCommunity.form().nameInput().locator.fill('Email community')
  await newCommunity.form().createButton().locator.click()
  await page.waitForURL(/\/communities\/\d+$/)

  const members = createCommunityMembersPageModel(page)
  await members.tabs().members().locator.click()
  await members.add().locator.click()
  const newMember = createNewCommunityMemberPageModel(page)
  await newMember.studentDialog().open().locator.click()
  await newMember.create().open().locator.click()
  await newMember.create().input('firstName').locator.fill('Ada')
  await newMember.create().input('lastName').locator.fill('Lovelace')
  await newMember.create().input('email').locator.fill('ada@example.com')
  await newMember.create().submit().locator.click()
  await expect(newMember.email().locator).toHaveValue('ada@example.com')
  await newMember.submit().locator.click()

  const member = createCommunityMemberPageModel(page)
  await page.waitForURL(member.urlRegex)
  await expect(member.state().field('Status').locator).toHaveText('Registration email sent', {
    timeout: 10_000,
  })
  expect(emailService().sentEmails).toHaveLength(1)
  const sent = emailService().sentEmails[0]
  expect(sent.message.to).toBe('ada@example.com')
  expect(sent.message.from).toBe('Carmbo <sender@example.com>')
  expect(sent.message.subject).toBe('Welcome to Email community')

  await member.state().registrationEmail().locator.click()
  const email = createEmailPageModel(page)
  await expect(createAllPagesPageModel(page).header().menu().emailsMenuItem().locator).toBeVisible()
  await expect(email.details().field('Recipient').locator).toHaveText('ada@example.com')
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')

  const body = JSON.stringify({
    type: 'email.delivered',
    created_at: new Date().toISOString(),
    data: {email_id: sent.id, tags: sent.message.tags},
  })
  const response = await request.post(new URL('/api/emails/resend/webhook', url()).href, {
    headers: resendHeaders(body),
    data: body,
  })
  expect(await response.json()).toEqual({outcome: 'applied'})

  await page.reload()
  await expect(email.details().field('Status').locator).toHaveText('Delivery confirmed')
})
