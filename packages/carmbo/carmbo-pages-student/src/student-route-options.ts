import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import type {NowService} from '@giltayar/carmbo-commons/commons/now-service'
import type {RavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/service'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'

export type StudentRouteOptions = {
  sql: Sql
  academyIntegration: AcademyIntegrationService | undefined
  academyAccountSubdomains: string[] | undefined
  smooveIntegration: SmooveIntegrationService | undefined
  ravmesserIntegration: RavmesserIntegrationService | undefined
  nowService: NowService
}

export type StudentControllerOptions = Omit<StudentRouteOptions, 'sql'> & {
  logger: FastifyBaseLogger
}
