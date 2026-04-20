import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import type {Sql} from 'postgres'
import {makeApp} from '../../../src/app/carmbo-app.ts'
import type {FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'
import postgres from 'postgres'
import {createFakeAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/testkit'
import {createFakeWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/testkit'
import {createFakeSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/testkit'
import {migrate} from '../../../src/sql/migration.ts'
import {fileURLToPath} from 'node:url'
import {resetHooks, type TEST_HookFunction} from '../../../src/commons/TEST_hooks.ts'
import {createFakeCardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/testkit'
import {TEST_resetJobHandlers} from '../../../src/domain/job/job-executor.ts'
import {initializei18next} from '../../../src/commons/i18next-utils.ts'
import {when} from '@giltayar/functional-commons'
import {createFakeSkoolIntegrationService} from '@giltayar/carmel-tools-skool-integration/testkit'

export type SmooveContact = {
  id: number
  email: string
  firstName: string
  lastName: string
  telephone: string
  lists: number[]
  signupDate: Date
  birthday?: Date
  isDeleted?: boolean
}

export function setup(
  testUrl: string,
  options?: {
    smooveContacts?: Record<number, SmooveContact>
    withAcademyIntegration?: boolean // default is true
    withSmooveIntegration?: boolean // default is true
    withSkoolIntegration?: boolean // default is true
  },
): {
  url: () => URL
  sql: () => Sql
  smooveIntegration: () => ReturnType<typeof createFakeSmooveIntegrationService>
  academyIntegration: () => ReturnType<typeof createFakeAcademyIntegrationService>
  cardcomIntegration: () => ReturnType<typeof createFakeCardcomIntegrationService>
  whatsappIntegration: () => ReturnType<typeof createFakeWhatsAppIntegrationService>
  skoolIntegration: () => ReturnType<typeof createFakeSkoolIntegrationService>
  TEST_hooks: Record<string, TEST_HookFunction>
  setTime: (date: Date) => void
  resetTime: () => void
} {
  const withSmooveIntegration = options?.withSmooveIntegration ?? true
  const withAcademyIntegration = options?.withAcademyIntegration ?? true
  const withSkoolIntegration = options?.withSkoolIntegration ?? true

  const TEST_hooks: Record<string, TEST_HookFunction> = {}
  let findAddress
  let teardown: (() => Promise<void>) | undefined
  let app: FastifyInstance
  let sql: Sql
  let url: URL
  let overridingDate: Date | undefined
  let smooveIntegration: ReturnType<typeof createFakeSmooveIntegrationService>
  let academyIntegration: ReturnType<typeof createFakeAcademyIntegrationService>
  let cardcomIntegration: ReturnType<typeof createFakeCardcomIntegrationService>
  let whatsappIntegration: ReturnType<typeof createFakeWhatsAppIntegrationService>
  let skoolIntegration: ReturnType<typeof createFakeSkoolIntegrationService>

  test.beforeAll(async () => {
    ;({findAddress, teardown} = await runDockerCompose(
      new URL('../docker-compose.yaml', import.meta.url),
      {variation: testUrl, containerCleanup: !!process.env.CI, forceRecreate: !!process.env.CI},
    ))

    const host = await findAddress('carmbo-postgres', 5432, {healthCheck: postgresHealthCheck})

    smooveIntegration = createFakeSmooveIntegrationService({
      lists: [
        {id: 2, name: 'Smoove List ID 1'},
        {id: 4, name: 'Smoove List Cancelling 2'},
        {id: 6, name: 'Smoove List Cancelled 3'},
        {id: 8, name: 'Smoove List Removed 4'},
        {id: 10, name: 'Smoove List ID A'},
        {id: 12, name: 'Smoove List Cancelling B'},
        {id: 14, name: 'Smoove List Cancelled C'},
        {id: 16, name: 'Smoove List Removed D'},
        {id: 20, name: 'Smoove List ID Alpha'},
      ],
      contacts: options?.smooveContacts ?? {},
    })
    academyIntegration = createFakeAcademyIntegrationService({
      accounts: new Map([
        [
          'carmel',
          {
            courses: [
              {id: 1, name: 'Course 1'},
              {id: 33, name: 'Course 2'},
              {id: 777, name: 'Course 3'},
              {id: 888, name: 'Course 4'},
            ],
            enrolledContacts: new Map([
              [
                'john.already-enrolled@example.com',
                {name: 'John Already-Enrolled', phone: '123-456-7890', enrolledInCourses: [1, 33]},
              ],
              [
                'jane.already-enrolled@example.com',
                {name: 'Jane Already-Enrolled', phone: '234-567-8901', enrolledInCourses: [1]},
              ],
              [
                'bob.already-enrolled@example.com',
                {name: 'Bob Already-Enrolled', phone: '345-678-9012', enrolledInCourses: [33]},
              ],
            ]),
          },
        ],
      ]),
    })
    cardcomIntegration = createFakeCardcomIntegrationService({accounts: {}})
    TEST_resetJobHandlers()
    skoolIntegration = createFakeSkoolIntegrationService()
    whatsappIntegration = createFakeWhatsAppIntegrationService({
      groups: {
        '1@g.us': {
          name: 'Test Group 1',
          recentSentMessages: [],
          participants: [],
        },
        '2@g.us': {
          name: 'Test Group 2',
          recentSentMessages: [],
          participants: [],
        },
        '3@g.us': {
          name: 'Test Group 3',
          recentSentMessages: [],
          participants: [],
        },
      },
    })
    ;({app, sql} = makeApp({
      db: {
        connectionString: undefined,
        database: 'carmbo',
        host: host.split(':')[0],
        port: parseInt(host.split(':')[1]),
        username: 'user',
        password: 'password',
      },
      services: {
        academyIntegration: when(withAcademyIntegration, () => academyIntegration),
        whatsappIntegration,
        smooveIntegration: when(withSmooveIntegration, () => smooveIntegration),
        cardcomIntegration,
        skoolIntegration: when(withSkoolIntegration, () => skoolIntegration),
        nowService: () => (overridingDate ? overridingDate : new Date()),
      },
      firebase: undefined,
      apiSecret: undefined,
      appBaseUrl: 'http://localhost:????',
      uiConfiguration: 'carmel',
      TEST_hooks,
    }))

    await migrate({sql, path: fileURLToPath(new URL('../../../src/sql', import.meta.url))})

    await initializei18next('en')

    await app.listen()
    app.server.unref()

    const {port, address} = app.server.address() as AddressInfo

    const httpAddress = address.includes('::') ? `[${address}]` : address

    url = new URL(`http://${httpAddress}:${port}`)
  })

  test.beforeEach(async () => {
    resetHooks()
    cardcomIntegration._test_reset_data()
    smooveIntegration._test_reset_data()
    whatsappIntegration._test_reset()
    skoolIntegration._test_reset()
    overridingDate = undefined
    await sql`TRUNCATE TABLE student RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE student_history RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE student_email RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE student_phone RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE student_data RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE product RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE product_history RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE product_data RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sales_event RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sales_event_history RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_history RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_data RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_data_product RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_data_search RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_data_cardcom_manual RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_data_delivery RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_data_active RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_data_cardcom RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE job RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_standing_order_payments RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_standing_order_cardcom_recurring_payment RESTART IDENTITY CASCADE`
  })

  test.afterAll(async () => teardown?.())

  return {
    url: () => url,
    sql: () => sql,
    smooveIntegration: () => smooveIntegration,
    academyIntegration: () => academyIntegration,
    cardcomIntegration: () => cardcomIntegration,
    whatsappIntegration: () => whatsappIntegration,
    skoolIntegration: () => skoolIntegration,
    TEST_hooks,
    setTime: (date: Date) => (overridingDate = date),
    resetTime: () => (overridingDate = undefined),
  }
}

async function postgresHealthCheck(address: string) {
  const [host, port] = address.split(':')

  const sql = postgres({
    host,
    port: parseInt(port, 10),
    database: 'carmbo',
    user: 'user',
    password: 'password',
  })

  await sql`SELECT 1`
}
