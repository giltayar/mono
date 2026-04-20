import {createAcademyIntegrationService} from '../../src/academy-integration.ts'
import {throw_} from '@giltayar/functional-commons'

const service = createAcademyIntegrationService({
  accounts: [
    {
      apiKey:
        process.env.ACADEMY_CARMEL_ACCOUNT_API_KEY ??
        throw_(new Error('Missing ACADEMY_CARMEL_ACCOUNT_API_KEY')),
      subdomain: 'carmel',
    },
  ],
})

await service.updateStudentEmail('giltayar@gmail.com', 'gil@tayar.org', {
  accountSubdomain: 'carmel',
})
