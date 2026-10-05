import {createFakeAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/testkit'
import {createFakeCardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/testkit'
import {createFakeRavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/testkit'
import {createFakeSkoolIntegrationService} from '@giltayar/carmel-tools-skool-integration/testkit'
import {createFakeSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/testkit'
import {createFakeWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/testkit'

export function createFakes() {
  const academyIntegration = createFakeAcademyIntegrationService({
    accounts: new Map([
      [
        'carmel',
        {
          courses: [
            {id: 1, name: 'Recorded Course'},
            {id: 2, name: 'Live Course'},
          ],
          enrolledContacts: new Map(),
        },
      ],
    ]),
  })
  const cardcomIntegration = createFakeCardcomIntegrationService({accounts: {}})
  const ravmesserIntegration = createFakeRavmesserIntegrationService({
    lists: [
      {id: 100, name: 'All Contacts', isAllLists: true},
      {id: 102, name: 'Customers'},
    ],
    contacts: {},
  })
  const skoolIntegration = createFakeSkoolIntegrationService()
  const smooveIntegration = createFakeSmooveIntegrationService({
    lists: [{id: 2, name: 'Customers'}],
    contacts: {},
  })
  const whatsappIntegration = createFakeWhatsAppIntegrationService({
    groups: {
      '1@g.us': {
        name: 'Customers',
        recentSentMessages: [],
        participants: [],
      },
    },
  })

  return {
    academyIntegration,
    cardcomIntegration,
    ravmesserIntegration,
    skoolIntegration,
    smooveIntegration,
    whatsappIntegration,
  }
}
