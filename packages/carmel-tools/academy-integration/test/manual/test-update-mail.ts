import {createAcademyIntegrationService} from '../../src/academy-integration.ts'
import {throw_} from '@giltayar/functional-commons'

const service = createAcademyIntegrationService({
  accountApiKey:
    process.env.ACADEMY_CARMEL_ACCOUNT_API_KEY ??
    throw_(new Error('Missing ACADEMY_CARMEL_ACCOUNT_API_KEY')),
})

await service.updateStudentEmail('giltayar@gmail.com', 'gil@tayar.org')
