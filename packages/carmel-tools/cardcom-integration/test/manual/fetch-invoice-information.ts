import {createCardcomIntegrationService} from '../../src/cardcom-integration.ts'

const service = await createCardcomIntegrationService({
  apiKey: process.env.CARDCOM_API_KEY!,
  apiKeyPassword: process.env.CARDCOM_API_KEY_PASSWORD!,
  terminalNumber: '150067',
})

console.dir(await service.fetchInvoiceInformation(18712))
