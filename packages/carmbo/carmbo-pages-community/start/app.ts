import formbody from '@fastify/formbody'
import {fastifyRequestContext} from '@fastify/request-context'
import fastifyStatic from '@fastify/static'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import {setUiConfiguration} from '@giltayar/carmbo-commons/commons/ui-configuration'
import {setVersion} from '@giltayar/carmbo-commons/commons/version'
import {layoutAssetRoutes} from '@giltayar/carmbo-commons/layout/assets'
import fastify, {type FastifyInstance} from 'fastify'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import type {Sql} from 'postgres'
import packageJson from '../package.json' with {type: 'json'}
import {routes} from '../src/route.ts'
import {routes as emailRoutes} from '../src/email/route.ts'
import {routes as studentRoutes} from '@giltayar/carmbo-pages-student/routes'
import qs from 'qs'
import {initializeJobExecutor} from '@giltayar/carmbo-pages-job/jobs/executor'
import {routes as jobRoutes, apiRoutes as jobApiRoutes} from '@giltayar/carmbo-pages-job/routes'
import {registerRegistrationEmailJobs} from '../src/email/jobs.ts'
import type {EmailService} from '../src/email/email-service.ts'

export async function createApp(
  database: Sql,
  {emailService, from}: {emailService: EmailService; from: string},
): Promise<FastifyInstance> {
  const language = process.env.LANGUAGE === 'he' ? 'he' : 'en'

  await initializei18next(language)
  setVersion(packageJson.version)
  setUiConfiguration(language === 'he' ? 'liraz' : 'carmel', {withCommunities: true})

  const app = fastify({logger: true})
  const nowService = () => new Date()
  initializeJobExecutor(database, app.log)
  const registrationEmails = registerRegistrationEmailJobs({
    sql: database,
    nowService,
    emailService,
    from,
    language,
  })
  app.register(formbody, {parser: (body) => qs.parse(body)})
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.register(fastifyRequestContext, {
    defaultStoreValues: () => ({TEST_hooks: undefined}),
  })
  app.register(layoutAssetRoutes)
  app.register(fastifyStatic, {
    root: new URL('./dist', import.meta.url),
    prefix: `/dist/${packageJson.version}/`,
    decorateReply: false,
    immutable: true,
    maxAge: '1y',
  })
  app.register(routes, {
    prefix: '/communities',
    sql: database,
    nowService,
    registrationEmails,
  })
  app.register(emailRoutes, {prefix: '/emails', sql: database})
  app.register(jobRoutes, {prefix: '/jobs', sql: database})
  app.register(jobApiRoutes, {
    prefix: '/api/jobs',
    secret: process.env.JOB_API_SECRET,
    nowService,
  })
  app.register(studentRoutes, {
    prefix: '/students',
    sql: database,
    nowService: () => new Date(),
    academyIntegration: undefined,
    academyAccountSubdomains: undefined,
    smooveIntegration: undefined,
    ravmesserIntegration: undefined,
  })
  app.get('/', async (_request, reply) => reply.redirect('/communities'))
  app.addHook('onListen', () => {
    void registrationEmails.execute().catch((err: unknown) => {
      app.log.error({err}, 'trigger-startup-email-jobs-failed')
    })
  })

  return app
}
