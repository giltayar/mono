import {createFakeAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/testkit'
import {createFakeRavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/testkit'
import {createFakeSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/testkit'

export function createFakes() {
  const smooveIntegration = createFakeSmooveIntegrationService({
    lists: [{id: 2, name: 'Smoove List'}],
    contacts: {},
  })
  const ravmesserIntegration = createFakeRavmesserIntegrationService({
    lists: [{id: 100, name: 'Ravmesser All Lists', isAllLists: true}],
    contacts: {},
  })
  const academyIntegration = createFakeAcademyIntegrationService({
    accounts: new Map([
      [
        'carmel',
        {
          courses: [{id: 1, name: 'Course 1'}],
          enrolledContacts: new Map([
            [
              'student@example.com',
              {name: 'Example Student', phone: '0501234567', enrolledInCourses: [1]},
            ],
          ]),
        },
      ],
    ]),
  })

  return {academyIntegration, ravmesserIntegration, smooveIntegration}
}
