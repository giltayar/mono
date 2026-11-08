import {expect, test} from '@playwright/test'
import {registerJobHandler} from '@giltayar/carmbo-pages-job/jobs/handler'
import {createNewStudentPageModel} from '@giltayar/carmbo-pages-student/testkit/page-model/new-student-page.model'
import {createStudentListPageModel} from '@giltayar/carmbo-pages-student/testkit/page-model/student-list-page.model'
import {createCommunityListPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/community-list-page.model'
import {createNewCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-page.model'
import {createNewProductPageModel} from '@giltayar/carmbo-pages-sale/testkit/page-model/products/new-product-page.model'
import {createProductListPageModel} from '@giltayar/carmbo-pages-sale/testkit/page-model/products/product-list-page.model'
import {createNewSalesEventPageModel} from '@giltayar/carmbo-pages-sale/testkit/page-model/sales-events/new-sales-event-page.model'
import {createSalesEventListPageModel} from '@giltayar/carmbo-pages-sale/testkit/page-model/sales-events/sales-event-list-page.model'
import {createSaleListPageModel} from '@giltayar/carmbo-pages-sale/testkit/page-model/sales/sale-list-page.model'
import {
  createTemplateListPageModel,
  createTemplatePageModel,
} from '@giltayar/carmbo-pages-email/testkit/page-model/template.model'
import {waitForHtmx} from '@giltayar/playwright-commons'
import {createJobListPageModel} from '../../page-model/jobs/job-list-page.model.ts'
import {setup} from '../common/setup.ts'
import {cardcomWebhookUrl} from '../common/cardcom-webhook.ts'

test.describe('package routes', () => {
  const {url, cardcomIntegration, emailService} = setup(import.meta.url, {withCommunities: true})

  test('email templates load the bundled editor, save, preview and send through app services', async ({
    page,
  }) => {
    const list = createTemplateListPageModel(page)
    const editor = createTemplatePageModel(page)
    await page.goto(new URL('/emails/templates', url()).href)
    await list.new().locator.click()
    await editor.name().locator.fill('Mounted template')
    await editor.subject().locator.fill('Hello {{name}}')
    await editor.text().locator.fill('Plain hello {{name}}')
    await editor.content().locator.fill('HTML hello {{name}}')
    await editor.sample('name').locator.fill('Ada')
    await editor.action('Save template').locator.click()
    await page.waitForURL(/\/emails\/templates\/\d+$/)
    await page.goto(new URL('/emails/templates', url()).href)
    await list.template('Mounted template').locator.click()
    await expect(editor.content().locator).toContainText('HTML hello {{name}}')
    await editor.action('Preview').locator.click()
    await expect(editor.preview().frame().locator).toContainText('HTML hello Ada')
    await editor.action('Close').locator.click()
    await editor.action('Send preview email').locator.click()
    await editor.recipient().locator.fill('preview@example.com')
    await editor.action('Send').locator.click()
    await expect(editor.status().locator).toContainText('accepted')
    expect(emailService().sentEmails).toHaveLength(1)
    expect(emailService().sentEmails[0].message).toMatchObject({
      from: 'Carmbo <sender@example.com>',
      to: 'preview@example.com',
      subject: 'Hello Ada',
      text: 'Plain hello Ada',
    })
    expect(emailService().sentEmails[0].message.html).toContain('HTML hello Ada')
  })

  test('community route lists a created community', async ({page}) => {
    await page.goto(new URL('/communities', url()).href)
    await expect(
      page.getByRole('navigation').getByRole('link', {name: 'Communities'}),
    ).toBeVisible()

    const communityList = createCommunityListPageModel(page)
    await communityList.createNewCommunityButton().locator.click()

    const newCommunity = createNewCommunityPageModel(page)
    await page.waitForURL(newCommunity.urlRegex)
    const form = newCommunity.form()
    await form.nameInput().locator.fill('Mounted Community')
    await form.descriptionInput().locator.fill('Community package smoke test')
    await form.createButton().locator.click()
    await page.waitForURL(/\/communities\/\d+$/)

    await page.goto(new URL('/communities', url()).href)
    const rows = communityList.list().rows()
    await expect(rows.locator).toHaveCount(1)
    await expect(rows.row(0).nameCell().locator).toHaveText('Mounted Community')
    await expect(rows.row(0).descriptionCell().locator).toHaveText('Community package smoke test')
  })

  test('student route lists a created student', async ({page}) => {
    await page.goto(new URL('/students', url()).href)

    const studentList = createStudentListPageModel(page)
    await studentList.createNewStudentButton().locator.click()

    const newStudent = createNewStudentPageModel(page)
    await page.waitForURL(newStudent.urlRegex)

    const form = newStudent.form()
    await form.names().firstNameInput(0).locator.fill('Ada')
    await form.names().lastNameInput(0).locator.fill('Lovelace')
    await form.emails().emailInput(0).locator.fill('ada@example.com')
    await form.phones().phoneInput(0).locator.fill('0501234567')
    await form.facebookNames().facebookNameInput(0).locator.fill('ada-lovelace')
    await form.createButton().locator.click()
    await page.waitForURL(/\/students\/\d+$/)

    await page.goto(new URL('/students', url()).href)

    const rows = studentList.list().rows()
    await expect(rows.locator).toHaveCount(1)
    await expect(rows.row(0).nameCell().locator).toHaveText('Ada Lovelace')
    await expect(rows.row(0).emailCell().locator).toHaveText('ada@example.com')
  })

  test('jobs route lists a submitted job', async ({page}) => {
    const submitJob = registerJobHandler(
      'carmbo-app-listing-smoke',
      () => new Date(),
      {isTrivial: false},
      ({name}: {name: string}) => `Smoke job: ${name}`,
      async () => {},
    )
    await submitJob(
      {name: 'Visible job'},
      {scheduledAt: new Date('3000-01-01T00:00:00.000Z'), retries: 1},
    )

    await page.goto(new URL('/jobs', url()).href)

    const rows = createJobListPageModel(page).list().rows()
    await expect(rows.locator).toHaveCount(1)
    await expect(rows.row(0).descriptionCell().locator).toHaveText('Smoke job: Visible job')
  })

  test('sale package routes create a Cardcom sale', async ({page}) => {
    await page.goto(new URL('/products', url()).href)

    const productList = createProductListPageModel(page)
    await productList.createNewProductButton().locator.click()

    const newProduct = createNewProductPageModel(page)
    await page.waitForURL(newProduct.urlRegex)

    const form = newProduct.form()
    await form.nameInput().locator.fill('Mounted package product')
    await form.productTypeSelect().locator.selectOption('recorded')
    await form.createButton().locator.click()
    await page.waitForURL(/\/products\/\d+$/)

    const productNumber = Number(new URL(page.url()).pathname.split('/').at(-1))

    await page.goto(new URL('/sales-events', url()).href)

    const salesEventList = createSalesEventListPageModel(page)
    await salesEventList.createNewSalesEventButton().locator.click()

    const newSalesEvent = createNewSalesEventPageModel(page)
    await page.waitForURL(newSalesEvent.urlRegex)

    const salesEventForm = newSalesEvent.form()
    await salesEventForm.nameInput().locator.fill('Mounted package sales event')
    await salesEventForm.fromDateInput().locator.fill('2026-01-01')
    await salesEventForm.toDateInput().locator.fill('2026-12-31')
    await salesEventForm.landingPageUrlInput().locator.fill('https://example.com/sale')
    await waitForHtmx(page, salesEventForm.productsForSale().addButton().locator.click())
    await waitForHtmx(page, async () => {
      await salesEventForm.productsForSale().productInput(0).locator.fill(productNumber.toString())
      await salesEventForm.productsForSale().productInput(0).locator.blur()
    })
    await salesEventForm.createButton().locator.click()
    await page.waitForURL(/\/sales-events\/\d+$/)

    const salesEventNumber = Number(new URL(page.url()).pathname.split('/').at(-1))
    await cardcomIntegration()._test_simulateCardcomSale(
      {
        productsSold: [
          {
            productId: productNumber.toString(),
            quantity: 1,
            unitPriceInCents: 10_000,
            productName: 'Mounted package product',
          },
        ],
        customerEmail: 'mounted-sale@example.com',
        customerName: 'Mounted Sale',
        customerPhone: '0501234567',
        cardcomCustomerId: 1234,
        transactionDate: new Date('2026-10-05T12:00:00.000Z'),
        transactionDescription: undefined,
        transactionRevenueInCents: 10_000,
      },
      undefined,
      cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
    )

    await page.goto(new URL('/sales', url()).href)

    const saleRows = createSaleListPageModel(page).list().rows()
    await expect(saleRows.locator).toHaveCount(1)
    await expect(saleRows.row(0).eventCell().locator).toHaveText('Mounted package sales event')
    await expect(saleRows.row(0).studentCell().locator).toHaveText('Mounted Sale')
    await expect(saleRows.row(0).revenueCell().locator).toContainText('100')
    await expect(saleRows.row(0).productsCell().locator).toContainText('Mounted package product')
  })
})

test.describe('Hebrew email templates', () => {
  const {url} = setup(`${import.meta.url}/hebrew-templates`, {
    withCommunities: true,
    language: 'he',
  })

  test('published editor loads with Hebrew controls inside the app', async ({page}) => {
    const editor = createTemplatePageModel(page)
    await page.goto(new URL('/emails/templates/new', url()).href)
    await expect(editor.languagePage().locator).toHaveAttribute('dir', 'rtl')
    await expect(editor.action('שמירת תבנית').locator).toBeEnabled()
    await expect(editor.hebrewContent().locator).toBeEditable()
    await expect(editor.inspector().locator).toHaveAccessibleName('עיצוב')
  })
})

test.describe('communities disabled', () => {
  const {url} = setup(`${import.meta.url}/without-communities`, {withCommunities: false})

  test('community routes are unavailable', async ({request}) => {
    for (const [method, path] of [
      ['GET', '/communities'],
      ['GET', '/emails'],
      ['GET', '/emails/templates'],
      ['GET', '/emails/templates/new'],
      ['GET', '/emails/templates/style.css'],
      ['GET', '/emails/templates/assets/1.1.1/editor.js'],
      ['POST', '/emails/templates/'],
      ['POST', '/emails/templates/new/preview'],
      ['POST', '/emails/templates/new/send-preview'],
      ['POST', '/api/emails/resend/webhook'],
    ]) {
      const response = await request.fetch(new URL(path, url()).href, {method})
      expect(response.status(), `${method} ${path}`).toBe(404)
    }
  })
})
