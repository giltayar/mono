import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'
import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import type {CardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {RavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/service'
import type {SkoolIntegrationService} from '@giltayar/carmel-tools-skool-integration/service'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {WhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import type {NowService} from '@giltayar/carmbo-commons/commons/now-service'
import type {TEST_HookFunction} from '@giltayar/carmbo-commons/commons/TEST_hooks'
import type {WhatsAppGroup} from '@giltayar/carmel-tools-whatsapp-integration/service'
import type {SmooveList} from '@giltayar/carmel-tools-smoove-integration/service'
import type {RavmesserList} from '@giltayar/carmel-tools-ravmesser-integration/service'

export type SaleRouteOptions = {
  sql: Sql
  appBaseUrl: string
  apiSecret: string | undefined
  academyIntegration: AcademyIntegrationService | undefined
  academyAccountSubdomains: string[] | undefined
  whatsappIntegration: WhatsAppIntegrationService
  smooveIntegration: SmooveIntegrationService | undefined
  ravmesserIntegration: RavmesserIntegrationService | undefined
  cardcomIntegration: CardcomIntegrationService
  skoolIntegration: SkoolIntegrationService | undefined
  nowService: NowService
  TEST_hooks?: Record<string, TEST_HookFunction>
}

declare module '@fastify/request-context' {
  interface RequestContextData {
    cardcomIntegration: CardcomIntegrationService
    whatsappIntegration: WhatsAppIntegrationService
    academyIntegration: AcademyIntegrationService | undefined
    academyAccountSubdomains: string[] | undefined
    smooveIntegration: SmooveIntegrationService | undefined
    ravmesserIntegration: RavmesserIntegrationService | undefined
    skoolIntegration: SkoolIntegrationService | undefined
    nowService: NowService
    logger: FastifyBaseLogger
    sql: Sql
    whatsappGroups: WhatsAppGroup[] | undefined
    smooveLists: SmooveList[] | undefined
    ravmesserLists: RavmesserList[] | undefined
    products: {id: number; name: string}[] | undefined
    TEST_hooks: Record<string, TEST_HookFunction> | undefined
  }
}
