import {makeApp} from './carmbo-app.ts'
import {createFakeAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/testkit'
import {createFakeWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/testkit'
import {createFakeSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/testkit'
import {createFakeCardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/testkit'
import {prepareDatabase} from './prepare-database.ts'

const {app, sql} = await makeApp({
  db: {
    database: 'carmbo',
    host: 'localhost',
    port: process.env.DB_HOST ? parseInt(process.env.DB_HOST) : 5432,
    username: 'user',
    password: 'password',
  },
  services: {
    academyIntegration: createFakeAcademyIntegrationService({
      courses: [
        {id: 1, name: 'Course 1'},
        {id: 33, name: 'Course 2'},
        {id: 777, name: 'Course 3'},
      ],
      enrolledContacts: new Map(),
    }),
    whatsappIntegration: createFakeWhatsAppIntegrationService({
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
    }),
    smooveIntegration: createFakeSmooveIntegrationService({
      lists: [
        {id: 2, name: 'Smoove List ID 1'},
        {id: 4, name: 'Smoove List Cancelling 2'},
        {id: 6, name: 'Smoove List Cancelled 3'},
        {id: 8, name: 'Smoove List Removed 4'},
        {id: 10, name: 'Smoove List ID A'},
        {id: 12, name: 'Smoove List Cancelling B'},
        {id: 14, name: 'Smoove List Cancelled C'},
        {id: 16, name: 'Smoove List Removed D'},
      ],
      contacts: {},
    }),
    cardcomIntegration: createFakeCardcomIntegrationService({accounts: {}}),
  },
  auth0: undefined,
  appBaseUrl: 'http://localhost:3000',
})

await prepareDatabase(sql)
await app.listen({port: 3000, host: 'localhost'})
