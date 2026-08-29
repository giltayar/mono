import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {cancelSubscription} from '../common/cancel-subscription.ts'
import {createCancelSubscriptionPageModel} from '../../page-model/sales/cancel-subscription-page.model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'
import {computeDisconnectTime} from '../../../src/domain/sale/model/model-standing-order.ts'
import {cardcomRecurringPaymentWebhookUrl, cardcomWebhookUrl} from './common/cardcom-webhook.ts'
import {waitForAllJobsToBeDone} from '../common/wait-for-all-jobs-to-be-done.ts'
import {createSaleProvidersPageModel} from '../../page-model/sales/sale-providers-page.model.ts'
import {fetchAsBuffer} from '@giltayar/http-commons'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {updateSaleNotes} from '../../../src/domain/sale/model/model.ts'
import {
  mailingListCard,
  mailingListFixtures,
  mailingListProductFields,
  mailingListProviders,
  mailingListTestkit,
} from '../common/mailing-list-provider.ts'

const {
  url,
  sql,
  smooveIntegration,
  ravmesserIntegration,
  cardcomIntegration,
  whatsappIntegration,
  academyIntegration,
  skoolIntegration,
  setTime,
} = setup(import.meta.url, {withRavmesserIntegration: true})

test.use({viewport: {width: 1280, height: 1280}})

for (const provider of mailingListProviders) {
  test(`cancelling a standing order subscription removes student from academy courses and updates mailing lists after the subscription ends (${provider})`, async ({
    page,
  }) => {
    const lists = mailingListFixtures[provider]
    const mailingList = mailingListTestkit(provider, {smooveIntegration, ravmesserIntegration})
    const academyCourseId = 1
    const ildAcademyCourseId = 100
    const mainListId = lists.main.id
    const cancelledListId = lists.cancelled.id
    const removedListId = lists.removed.id
    const removedDateCustomField = 42

    const product1Number = await createProduct(
      {
        name: 'Product One',
        productType: 'club',
        academyCourses: [
          {courseId: academyCourseId, accountSubdomain: 'carmel'},
          {courseId: ildAcademyCourseId, accountSubdomain: 'inspiredlivingdaily'},
        ],
        ...mailingListProductFields(provider, {
          listId: mainListId,
          cancelledListId,
          removedListId,
          removedDateCustomField,
        }),
        whatsappGroups: [{id: '1@g.us'}, {id: '3@g.us'}],
        personalMessageWhenJoining: 'Welcome to Product One!',
      },
      undefined,
      new Date(),
      sql(),
    )

    const salesEventNumber = await createSalesEvent(
      {
        name: 'Test Sales Event',
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-12-31'),
        landingPageUrl: 'https://example.com/test-sale',
        productsForSale: [product1Number],
      },
      undefined,
      new Date(),
      sql(),
    )

    const customerEmail = 'test-customer@example.com'
    const customerName = 'John Doe'
    const customerPhone = '0501234567'

    // Create a standing order sale
    await cardcomIntegration()._test_simulateCardcomStandingOrder(
      {
        productsSold: [
          {
            productId: product1Number.toString(),
            quantity: 1,
            unitPriceInCents: 100 * 100,
            productName: 'Product One',
          },
        ],
        customerEmail,
        customerName,
        customerPhone,
        cardcomCustomerId: 1776,
        transactionDate: new Date(),
        transactionDescription: undefined,
        transactionRevenueInCents: 100 * 100,
      },
      undefined,
      cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
      cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
    )

    // Verify student was enrolled in academy course
    await expect(async () => {
      const academyContact = academyIntegration()._test_getContact(customerEmail, 'carmel')
      expect(academyContact).toBeDefined()
      expect(
        await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId, {
          accountSubdomain: 'carmel',
        }),
      ).toBe(true)
    }).toPass()

    // Verify student was subscribed to the mailing list
    await expect(async () => {
      const contacts = await mailingList.contactsOfList(mainListId)
      expect(contacts.length).toBe(1)
      expect(contacts[0].email).toBe(customerEmail)
    }).toPass()

    // Verify personal message was sent
    await expect(async () => {
      const contactId = humanIsraeliPhoneNumberToWhatsAppId(customerPhone)
      const sentMessages = whatsappIntegration()._test_sentContactMessages(contactId)
      expect(sentMessages).toContain('Welcome to Product One!')
    }).toPass()

    await waitForAllJobsToBeDone(page, url())

    // Verify skool invitation was not sent
    expect(skoolIntegration()._test_isInviteSentForEmail(customerEmail)).toBe(false)

    // Adding student to whatsapp group is done manually by the student
    await whatsappIntegration().addParticipantToGroup(
      '1@g.us',
      humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
    )
    await whatsappIntegration().addParticipantToGroup(
      '3@g.us',
      humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
    )
    // Verify student was added to whatsapp groups
    expect(await whatsappIntegration()._test_listParticipantsInGroup('1@g.us')).toContain(
      humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
    )
    expect(await whatsappIntegration()._test_listParticipantsInGroup('3@g.us')).toContain(
      humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
    )

    // Verify providers page shows everything connected
    await page.goto(new URL('/sales/1/providers', url()).href)
    await page.waitForURL(/\/sales\/1\/providers$/)

    const providersPageModel = createSaleProvidersPageModel(page)
    await expect(providersPageModel.pageTitle().locator).toContainText('Sale 1')

    const productCards = providersPageModel.productCards()
    await expect(productCards.locator).toHaveCount(1)

    const productCard = productCards.card(0)
    await expect(productCard.title().locator).toContainText('Product One')

    // Verify academy course is connected
    const academyCourses = productCard.academyCourses()
    await expect(academyCourses.courseCheckbox(`carmel/${academyCourseId}`).locator).toBeChecked()
    await expect(academyCourses.courseName(`carmel/${academyCourseId}`).locator).toHaveText(
      'carmel/1: Course 1',
    )
    await expect(
      academyCourses.courseCheckbox(`inspiredlivingdaily/${ildAcademyCourseId}`).locator,
    ).toBeChecked()
    await expect(
      academyCourses.courseName(`inspiredlivingdaily/${ildAcademyCourseId}`).locator,
    ).toHaveText('inspiredlivingdaily/100: ILD Course 1')

    // Verify mailing list main list is connected
    const mailingLists = mailingListCard(productCard, provider)
    await expect(mailingLists.mainListCheckbox().locator).toBeChecked()
    await expect(mailingLists.mainListName().locator).toHaveText(`Main list (${lists.main.name})`)
    await expect(mailingLists.cancelledListCheckbox().locator).not.toBeChecked()
    await expect(mailingLists.cancelledListName().locator).toHaveText(
      `Cancelled list (${lists.cancelled.name})`,
    )
    await expect(mailingLists.removedListCheckbox().locator).not.toBeChecked()
    await expect(mailingLists.removedListName().locator).toHaveText(
      `Removed list (${lists.removed.name})`,
    )

    // Verify whatsapp groups are connected
    const whatsappGroups = productCard.whatsAppGroups()
    await expect(whatsappGroups.groupCheckbox('1@g.us').locator).toBeChecked()
    await expect(whatsappGroups.groupName('1@g.us').locator).toHaveText('1@g.us: Test Group 1')
    await expect(whatsappGroups.groupCheckbox('3@g.us').locator).toBeChecked()
    await expect(whatsappGroups.groupName('3@g.us').locator).toHaveText('3@g.us: Test Group 3')

    // Cancel the subscription via the cancel subscription page
    await cancelSubscription(page, url(), product1Number, customerEmail)
    const saleDetailModel = createUpdateSalePageModel(page)
    const saleHistory = saleDetailModel.history()

    await expect(async () => {
      // Navigate to the sale page to verify the history
      await page.goto(new URL('/sales/1', url()).href)

      // Verify the sale history includes a cancel-subscription entry
      await expect(saleHistory.items().locator).toHaveCount(2)
      await expect(saleHistory.items().item(0).locator).toContainText('canceled subscription')
      await expect(saleHistory.items().item(1).locator).toContainText('created')
    }).toPass()

    // Verify sale status shows unsubscribed
    await expect(saleDetailModel.saleStatus().locator).toHaveText(
      'Subscription (unsubscribed) | Connected to External Providers',
    )

    // Verify student was NOT removed from academy course
    expect(
      await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId, {
        accountSubdomain: 'carmel',
      }),
    ).toBe(true)
    expect(
      await academyIntegration().isStudentEnrolledInCourse(customerEmail, ildAcademyCourseId, {
        accountSubdomain: 'inspiredlivingdaily',
      }),
    ).toBe(true)

    // Verify mailing lists were updated according to the unsubscribe logic
    await expect(async () => {
      const mainContacts = await mailingList.contactsOfList(mainListId)
      expect(mainContacts.length).toBe(0)

      const cancelledContacts = await mailingList.contactsOfList(cancelledListId)
      expect(cancelledContacts.length).toBe(1)
      expect(cancelledContacts[0].email).toBe(customerEmail)
    }).toPass()

    const contact = await mailingList.contactByEmail(customerEmail)
    const removedDateValue = mailingList.removedDateOf(contact.id, removedDateCustomField) as Date
    const expectedDisconnectTime = computeDisconnectTime({
      unsubscribeTimestamp: new Date(),
      subscriptionTimestamp: new Date(),
    })
    expect(removedDateValue.toISOString().slice(0, 10)).toBe(
      expectedDisconnectTime.toISOString().slice(0, 10),
    )

    // Verify student was NOT removed from whatsapp groups yet
    expect(await whatsappIntegration()._test_listParticipantsInGroup('1@g.us')).toContain(
      humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
    )
    expect(await whatsappIntegration()._test_listParticipantsInGroup('3@g.us')).toContain(
      humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
    )

    // Verify providers page shows cancelled list is now connected
    await page.goto(new URL('/sales/1/providers', url()).href)
    await page.waitForURL(/\/sales\/1\/providers$/)

    const providersPageModel2 = createSaleProvidersPageModel(page)
    const productCards2 = providersPageModel2.productCards()
    const productCard2 = productCards2.card(0)

    // Academy course should still be connected
    const academyCourses2 = productCard2.academyCourses()
    await expect(academyCourses2.courseCheckbox(academyCourseId.toString()).locator).toBeChecked()
    await expect(
      academyCourses2.courseCheckbox(`inspiredlivingdaily/${ildAcademyCourseId}`).locator,
    ).toBeChecked()

    // Mailing list cancelled list should now be connected
    const mailingLists2 = mailingListCard(productCard2, provider)
    await expect(mailingLists2.mainListCheckbox().locator).not.toBeChecked()
    await expect(mailingLists2.cancelledListCheckbox().locator).toBeChecked()
    await expect(mailingLists2.removedListCheckbox().locator).not.toBeChecked()

    // WhatsApp groups should still be connected
    const whatsappGroups2 = productCard2.whatsAppGroups()
    await expect(whatsappGroups2.groupCheckbox('1@g.us').locator).toBeChecked()
    await expect(whatsappGroups2.groupCheckbox('3@g.us').locator).toBeChecked()

    setTime(new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000)) // Advance time by 2 weeks

    await fetchAsBuffer(new URL('/api/jobs/trigger-job-execution?secret=', url()), {method: 'POST'})

    // Verify student was STILL not removed from academy course
    expect(
      await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId, {
        accountSubdomain: 'carmel',
      }),
    ).toBe(true)
    expect(
      await academyIntegration().isStudentEnrolledInCourse(customerEmail, ildAcademyCourseId, {
        accountSubdomain: 'inspiredlivingdaily',
      }),
    ).toBe(true)

    // Verify mailing lists were STILL the same
    await expect(async () => {
      const mainContacts = await mailingList.contactsOfList(mainListId)
      expect(mainContacts.length).toBe(0)

      const cancelledContacts = await mailingList.contactsOfList(cancelledListId)
      expect(cancelledContacts.length).toBe(1)
    }).toPass()

    // Verify student was NOT removed from whatsapp groups yet
    expect(await whatsappIntegration()._test_listParticipantsInGroup('1@g.us')).toContain(
      humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
    )
    expect(await whatsappIntegration()._test_listParticipantsInGroup('3@g.us')).toContain(
      humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
    )

    setTime(new Date(Date.now() + 5 * 7 * 24 * 60 * 60 * 1000)) // Advance time by 5 weeks

    await fetchAsBuffer(new URL('/api/jobs/trigger-job-execution?secret=', url()), {method: 'POST'})

    await expect
      .poll(async () =>
        // Verify student WAS removed from academy course
        academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId, {
          accountSubdomain: 'carmel',
        }),
      )
      .toBe(false)

    expect(
      await academyIntegration().isStudentEnrolledInCourse(customerEmail, ildAcademyCourseId, {
        accountSubdomain: 'inspiredlivingdaily',
      }),
    ).toBe(false)

    // Verify mailing lists were updated according to the unsubscribe logic
    const mainContacts1 = await mailingList.contactsOfList(mainListId)
    // Student should no longer be in the main list
    expect(mainContacts1.length).toBe(0)
    const cancelledContacts1 = await mailingList.contactsOfList(cancelledListId)
    expect(cancelledContacts1.length).toBe(0)
    // Student should be in the removed list
    const removedContacts = await mailingList.contactsOfList(removedListId)
    expect(removedContacts.length).toBe(1)
    expect(removedContacts[0].email).toBe(customerEmail)

    // Verify student WAS removed from whatsapp groups yet
    expect(await whatsappIntegration()._test_listParticipantsInGroup('1@g.us')).not.toContain(
      humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
    )
    expect(await whatsappIntegration()._test_listParticipantsInGroup('3@g.us')).not.toContain(
      humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
    )

    // Verify providers page shows everything is disconnected and moved to removed list
    await page.goto(new URL('/sales/1/providers', url()).href)
    await page.waitForURL(/\/sales\/1\/providers$/)

    const providersPageModel3 = createSaleProvidersPageModel(page)
    const productCards3 = providersPageModel3.productCards()
    const productCard3 = productCards3.card(0)

    // Academy course should now be disconnected
    const academyCourses3 = productCard3.academyCourses()
    await expect(
      academyCourses3.courseCheckbox(`carmel/${academyCourseId}`).locator,
    ).not.toBeChecked()
    await expect(
      academyCourses3.courseCheckbox(`inspiredlivingdaily/${ildAcademyCourseId}`).locator,
    ).not.toBeChecked()

    // Mailing list removed list should now be connected
    const mailingLists3 = mailingListCard(productCard3, provider)
    await expect(mailingLists3.mainListCheckbox().locator).not.toBeChecked()
    await expect(mailingLists3.cancelledListCheckbox().locator).not.toBeChecked()
    await expect(mailingLists3.removedListCheckbox().locator).toBeChecked()

    // WhatsApp groups should be disconnected
    const whatsappGroups3 = productCard3.whatsAppGroups()
    await expect(whatsappGroups3.groupCheckbox('1@g.us').locator).not.toBeChecked()
    await expect(whatsappGroups3.groupCheckbox('3@g.us').locator).not.toBeChecked()

    await page.goto(new URL('/sales/1', url()).href)
    await page.reload()

    await expect(saleHistory.items().locator).toHaveCount(3)
    await expect(saleHistory.items().item(0).locator).toContainText('removed from subscription')
    await expect(saleHistory.items().item(1).locator).toContainText('canceled subscription')
    await expect(saleHistory.items().item(2).locator).toContainText('created')
  })

  test(`cancelling a standing order subscription works even if email is not the main email (${provider})`, async ({
    page,
  }) => {
    const lists = mailingListFixtures[provider]
    const mailingList = mailingListTestkit(provider, {smooveIntegration, ravmesserIntegration})
    const academyCourseId = 1
    const mainListId = lists.main.id
    const cancelledListId = lists.cancelled.id
    const removedListId = lists.removed.id

    const product1Number = await createProduct(
      {
        name: 'Product One',
        productType: 'recorded',
        academyCourses: [{courseId: academyCourseId, accountSubdomain: 'carmel'}],
        ...mailingListProductFields(provider, {
          listId: mainListId,
          cancelledListId,
          removedListId,
        }),
        whatsappGroups: [{id: '1@g.us'}, {id: '3@g.us'}],
        personalMessageWhenJoining: 'Welcome to Product One!',
        sendSkoolInvitation: true,
      },
      undefined,
      new Date(),
      sql(),
    )

    const mainEmail = 'main-email@example.com'
    const subscribedViaEmail = 'test-customer@example.com'
    const customerName = 'John Doe'
    const customerPhone = '0501234567'

    await createStudent(
      {
        names: [{firstName: 'Jane', lastName: 'Doe'}],
        emails: [mainEmail, subscribedViaEmail],
        phones: [],
        facebookNames: [],
      },
      undefined,
      smooveIntegration(),
      ravmesserIntegration(),
      new Date(),
      sql(),
    )

    const salesEventNumber = await createSalesEvent(
      {
        name: 'Test Sales Event',
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-12-31'),
        landingPageUrl: 'https://example.com/test-sale',
        productsForSale: [product1Number],
      },
      undefined,
      new Date(),
      sql(),
    )

    // Create a standing order sale
    await cardcomIntegration()._test_simulateCardcomStandingOrder(
      {
        productsSold: [
          {
            productId: product1Number.toString(),
            quantity: 1,
            unitPriceInCents: 100 * 100,
            productName: 'Product One',
          },
        ],
        customerEmail: subscribedViaEmail,
        customerName,
        customerPhone,
        cardcomCustomerId: 1776,
        transactionDate: new Date(),
        transactionDescription: undefined,
        transactionRevenueInCents: 100 * 100,
      },
      undefined,
      cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
      cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
    )

    // Cancel the subscription via the cancel subscription page using product number
    await cancelSubscription(page, url(), product1Number, subscribedViaEmail)
    const saleDetailModel = createUpdateSalePageModel(page)
    const saleHistory = saleDetailModel.history()

    await expect(async () => {
      // Navigate to the sale page to verify the history
      await page.goto(new URL('/sales/1', url()).href)

      // Verify the sale history includes a cancel-subscription entry
      await expect(saleHistory.items().locator).toHaveCount(2)
      await expect(saleHistory.items().item(0).locator).toContainText('canceled subscription')
      await expect(saleHistory.items().item(1).locator).toContainText('created')
    }).toPass()

    // Verify sale status shows unsubscribed
    await expect(saleDetailModel.saleStatus().locator).toHaveText(
      'Subscription (unsubscribed) | Connected to External Providers',
    )

    // Verify mailing lists were updated according to the unsubscribe logic
    await expect(async () => {
      const mainContacts = await mailingList.contactsOfList(mainListId)
      expect(mainContacts.length).toBe(0)

      const cancelledContacts = await mailingList.contactsOfList(cancelledListId)
      expect(cancelledContacts.length).toBe(1)
      expect(cancelledContacts[0].email).toBe(mainEmail)
    }).toPass()
  })

  test(`cancelling a standing order subscription by product number (${provider})`, async ({
    page,
  }) => {
    const lists = mailingListFixtures[provider]
    const mailingList = mailingListTestkit(provider, {smooveIntegration, ravmesserIntegration})
    const academyCourseId = 1
    const mainListId = lists.main.id
    const cancelledListId = lists.cancelled.id
    const removedListId = lists.removed.id

    const product1Number = await createProduct(
      {
        name: 'Product One',
        productType: 'recorded',
        academyCourses: [{courseId: academyCourseId, accountSubdomain: 'carmel'}],
        ...mailingListProductFields(provider, {
          listId: mainListId,
          cancelledListId,
          removedListId,
        }),
        whatsappGroups: [{id: '1@g.us'}, {id: '3@g.us'}],
        personalMessageWhenJoining: 'Welcome to Product One!',
        sendSkoolInvitation: true,
      },
      undefined,
      new Date(),
      sql(),
    )

    const salesEventNumber = await createSalesEvent(
      {
        name: 'Test Sales Event',
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-12-31'),
        landingPageUrl: 'https://example.com/test-sale',
        productsForSale: [product1Number],
      },
      undefined,
      new Date(),
      sql(),
    )

    const customerEmail = 'test-customer@example.com'
    const customerName = 'John Doe'
    const customerPhone = '0501234567'

    // Create a standing order sale
    await cardcomIntegration()._test_simulateCardcomStandingOrder(
      {
        productsSold: [
          {
            productId: product1Number.toString(),
            quantity: 1,
            unitPriceInCents: 100 * 100,
            productName: 'Product One',
          },
        ],
        customerEmail,
        customerName,
        customerPhone,
        cardcomCustomerId: 1776,
        transactionDate: new Date(),
        transactionDescription: undefined,
        transactionRevenueInCents: 100 * 100,
      },
      undefined,
      cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
      cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
    )

    // Verify student was enrolled in academy course
    await expect(async () => {
      const academyContact = academyIntegration()._test_getContact(customerEmail, 'carmel')
      expect(academyContact).toBeDefined()
      expect(
        await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId, {
          accountSubdomain: 'carmel',
        }),
      ).toBe(true)
    }).toPass()

    // Verify student was subscribed to the mailing list
    await expect(async () => {
      const contacts = await mailingList.contactsOfList(mainListId)
      expect(contacts.length).toBe(1)
      expect(contacts[0].email).toBe(customerEmail)
    }).toPass()

    // Verify personal message was sent
    await expect(async () => {
      const contactId = humanIsraeliPhoneNumberToWhatsAppId(customerPhone)
      const sentMessages = whatsappIntegration()._test_sentContactMessages(contactId)
      expect(sentMessages).toContain('Welcome to Product One!')
    }).toPass()

    // Verify skool invitation was sent
    await expect(async () => {
      expect(skoolIntegration()._test_isInviteSentForEmail(customerEmail)).toBe(true)
    }).toPass()

    // Cancel the subscription via the cancel subscription page using product number
    await cancelSubscription(page, url(), product1Number, customerEmail)
    const saleDetailModel = createUpdateSalePageModel(page)
    const saleHistory = saleDetailModel.history()

    await expect(async () => {
      // Navigate to the sale page to verify the history
      await page.goto(new URL('/sales/1', url()).href)

      // Verify the sale history includes a cancel-subscription entry
      await expect(saleHistory.items().locator).toHaveCount(2)
      await expect(saleHistory.items().item(0).locator).toContainText('canceled subscription')
      await expect(saleHistory.items().item(1).locator).toContainText('created')
    }).toPass()

    // Verify sale status shows unsubscribed
    await expect(saleDetailModel.saleStatus().locator).toHaveText(
      'Subscription (unsubscribed) | Connected to External Providers',
    )

    // Verify mailing lists were updated according to the unsubscribe logic
    await expect(async () => {
      const mainContacts = await mailingList.contactsOfList(mainListId)
      expect(mainContacts.length).toBe(0)

      const cancelledContacts = await mailingList.contactsOfList(cancelledListId)
      expect(cancelledContacts.length).toBe(1)
      expect(cancelledContacts[0].email).toBe(customerEmail)
    }).toPass()
  })
}

test('cancelling a subscription by product fails when multiple sales exist for the same product', async ({
  page,
}) => {
  const academyCourseId = 1
  const smooveListId = 2
  const smooveCancelledListId = 6

  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [{courseId: academyCourseId, accountSubdomain: 'carmel'}],
      smooveListId,
      smooveCancelledListId,
    },
    undefined,
    new Date(),
    sql(),
  )

  const salesEvent1Number = await createSalesEvent(
    {
      name: 'Sales Event One',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-06-30'),
      landingPageUrl: 'https://example.com/event-1',
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const salesEvent2Number = await createSalesEvent(
    {
      name: 'Sales Event Two',
      fromDate: new Date('2025-07-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/event-2',
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const customerEmail = 'test-customer@example.com'
  const customerName = 'John Doe'
  const customerPhone = '0501234567'

  // Create first standing order sale (via sales event 1)
  await cardcomIntegration()._test_simulateCardcomStandingOrder(
    {
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Product One',
        },
      ],
      customerEmail,
      customerName,
      customerPhone,
      cardcomCustomerId: 1776,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 100 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEvent1Number, url(), 'secret'),
    cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
  )

  // Create second standing order sale (via sales event 2, same product)
  await cardcomIntegration()._test_simulateCardcomStandingOrder(
    {
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Product One',
        },
      ],
      customerEmail,
      customerName,
      customerPhone,
      cardcomCustomerId: 1777,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 100 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEvent2Number, url(), 'secret'),
    cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
  )

  // Wait for both sales to be created
  await expect(async () => {
    await page.goto(new URL('/sales', url()).href)
    const saleListModel = createSaleListPageModel(page)
    await expect(saleListModel.list().rows().locator).toHaveCount(2)
  }).toPass()

  // Cancel subscription by product — should fail because there are two sales with the same product
  await cancelSubscription(page, url(), product1Number, customerEmail)

  // Verify the error page is shown with the multiple sales error message
  const cancelSubscriptionPage = createCancelSubscriptionPageModel(page)
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText(
    'Multiple subscriptions',
  )

  // unfortunately, need to wait some time because we're checking that something has NOT happened
  await page.waitForTimeout(1000)

  // Verify neither sale was cancelled — both should still show as active subscriptions
  await page.goto(new URL('/sales/1', url()).href)
  const sale1Model = createUpdateSalePageModel(page)
  await expect(sale1Model.saleStatus().locator).toHaveText(
    'Subscription | Connected to External Providers',
  )

  await page.goto(new URL('/sales/2', url()).href)
  const sale2Model = createUpdateSalePageModel(page)
  await expect(sale2Model.saleStatus().locator).toHaveText(
    'Subscription | Connected to External Providers',
  )
})

test('cancelling a subscription by product succeeds when the sale has more than one history item', async ({
  page,
}) => {
  // Regression test for https://github.com/giltayar/mono/issues/82: a sale that
  // already has multiple history entries (e.g. its notes were updated) must still
  // be found as a single sale, not reported as "multiple sales found".
  const academyCourseId = 1
  const smooveListId = 2
  const smooveCancelledListId = 6

  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [{courseId: academyCourseId, accountSubdomain: 'carmel'}],
      smooveListId,
      smooveCancelledListId,
    },
    undefined,
    new Date(),
    sql(),
  )

  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test-sale',
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const customerEmail = 'test-customer@example.com'
  const customerName = 'John Doe'
  const customerPhone = '0501234567'

  // Create a standing order sale
  await cardcomIntegration()._test_simulateCardcomStandingOrder(
    {
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Product One',
        },
      ],
      customerEmail,
      customerName,
      customerPhone,
      cardcomCustomerId: 1776,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 100 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
    cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
  )

  // Update the sale notes so the sale has a second history entry before it's ever cancelled.
  await updateSaleNotes(1, 'Called to confirm the order', new Date(), sql())
  const saleDetailModel = createUpdateSalePageModel(page)
  const saleHistory = saleDetailModel.history()

  await expect(async () => {
    await page.goto(new URL('/sales/1', url()).href)
    await expect(saleHistory.items().locator).toHaveCount(2)
  }).toPass()

  // Cancel the subscription via the product-based flow — this used to throw
  // "Multiple sales found" because the query matched every history row instead of
  // just the sale's current data.
  await cancelSubscription(page, url(), product1Number, customerEmail)

  const cancelSubscriptionPage = createCancelSubscriptionPageModel(page)
  await expect(cancelSubscriptionPage.errorMessage().locator).not.toContainText(
    'Multiple subscriptions',
  )
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText('has been cancelled')
})

test('cancel subscription shows error when email is not found', async ({page}) => {
  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'club',
    },
    undefined,
    new Date(),
    sql(),
  )

  await cancelSubscription(page, url(), productNumber, 'nonexistent@example.com')

  const cancelSubscriptionPage = createCancelSubscriptionPageModel(page)
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText(
    'nonexistent@example.com',
  )
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText(
    'No subscription was found',
  )
})

test('cancel subscription shows error when student exists but has no subscription to this product', async ({
  page,
}) => {
  const productNumber = await createProduct(
    {
      name: 'Product Two',
      productType: 'club',
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a student (but no sale for product2)
  await createStudent(
    {
      names: [{firstName: 'Jane', lastName: 'Doe'}],
      emails: ['jane@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    ravmesserIntegration(),
    new Date(),
    sql(),
  )

  await cancelSubscription(page, url(), productNumber, 'jane@example.com')

  const cancelSubscriptionPage = createCancelSubscriptionPageModel(page)
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText(
    'No subscription was found',
  )
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText('jane@example.com')
})
