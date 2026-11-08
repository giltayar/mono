import formbody from '@fastify/formbody'
import {fastifyRequestContext} from '@fastify/request-context'
import fastifyStatic from '@fastify/static'
import {finalHtml} from '@giltayar/carmbo-commons/commons/controller-result'
import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import {setUiConfiguration} from '@giltayar/carmbo-commons/commons/ui-configuration'
import {setVersion} from '@giltayar/carmbo-commons/commons/version'
import {layoutAssetRoutes} from '@giltayar/carmbo-commons/layout/assets'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import {initializeJobExecutor, triggerJobsExecution} from '@giltayar/carmbo-pages-job/jobs/executor'
import {routes as jobRoutes, apiRoutes as jobApiRoutes} from '@giltayar/carmbo-pages-job/routes'
import fastify, {type FastifyInstance} from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import type {Sql} from 'postgres'
import {z} from 'zod'
import packageJson from '../package.json' with {type: 'json'}
import type {EmailService} from '../src/email-service.ts'
import {registerSendEmailJobHandler} from '../src/jobs.ts'
import {routes as emailRoutes} from '../src/route.ts'
import {webhookRoutes} from '../src/webhook-route.ts'

const RESEND_WEBHOOK_ROUTE_PREFIX = '/api/emails/resend'
export const RESEND_WEBHOOK_PATH = `${RESEND_WEBHOOK_ROUTE_PREFIX}/webhook`
export const TEST_EMAIL_PATH = '/dev/test-email'

export async function createApp(
  database: Sql,
  {
    emailService,
    from,
    webhookSigningSecret,
  }: {emailService: EmailService; from: string; webhookSigningSecret: string},
): Promise<FastifyInstance> {
  const language = process.env.LANGUAGE === 'he' ? 'he' : 'en'

  await initializei18next(language)
  setVersion(packageJson.version)
  setUiConfiguration(language === 'he' ? 'liraz' : 'carmel', {withCommunities: true})

  const app = fastify({logger: true})
  const nowService = () => new Date()
  initializeJobExecutor(database, app.log)
  // Test emails have no owning domain, so no result handler is registered.
  const queueEmail = registerSendEmailJobHandler({sql: database, nowService, emailService})
  app.register(formbody)
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
  app.register(emailRoutes, {prefix: '/emails', sql: database})
  app.register(webhookRoutes, {
    prefix: RESEND_WEBHOOK_ROUTE_PREFIX,
    sql: database,
    signingSecret: webhookSigningSecret,
  })
  app.register(jobRoutes, {prefix: '/jobs', sql: database})
  app.register(jobApiRoutes, {
    prefix: '/api/jobs',
    secret: process.env.JOB_API_SECRET,
    nowService,
  })

  app.get(TEST_EMAIL_PATH, async (_request, reply) =>
    reply.type('text/html').send(finalHtml(renderTestEmailForm())),
  )
  app.withTypeProvider<ZodTypeProvider>().post(
    TEST_EMAIL_PATH,
    {
      schema: {
        body: z.object({to: z.email(), subject: z.string().min(1), text: z.string().min(1)}),
      },
    },
    async (request, reply) => {
      const {to, subject, text} = request.body
      const now = nowService()
      const {emailNumber} = await database.begin((tx) =>
        queueEmail(
          {
            purpose: 'registration-email',
            from,
            to,
            subject,
            html: renderTestEmailHtml(text, language),
            text,
            language,
            payload: {source: 'standalone-test-email'},
          },
          now,
          tx,
        ),
      )
      void triggerJobsExecution(nowService).catch((err: unknown) => {
        app.log.error({err}, 'trigger-test-email-job-failed')
      })
      return reply.redirect(`/emails/${emailNumber}`, 303)
    },
  )
  app.get('/', async (_request, reply) => reply.redirect('/emails'))
  app.addHook('onListen', () => {
    // Resumes jobs persisted before a restart.
    void triggerJobsExecution(nowService).catch((err: unknown) => {
      app.log.error({err}, 'trigger-startup-email-jobs-failed')
    })
  })

  return app
}

function renderTestEmailForm(): string | string[] {
  return html`
    <${MainLayout} title="Send a test email" activeNavItem="emails">
      <div class="py-4" style="max-width: 40rem">
        <h2>Send a test email</h2>
        <p class="text-body-secondary">
          Sends a real email through Resend. Use <code>delivered@resend.dev</code> or
          <code>bounced@resend.dev</code> to simulate outcomes.
        </p>
        <form method="post" action=${TEST_EMAIL_PATH}>
          <div class="mb-3">
            <label for="to" class="form-label">To</label>
            <input id="to" name="to" type="email" class="form-control" required value="delivered@resend.dev" />
          </div>
          <div class="mb-3">
            <label for="subject" class="form-label">Subject</label>
            <input id="subject" name="subject" class="form-control" required value="Test email" />
          </div>
          <div class="mb-3">
            <label for="text" class="form-label">Body</label>
            <textarea id="text" name="text" class="form-control" rows="5" required>Hello from carmbo-pages-email.</textarea>
          </div>
          <button type="submit" class="btn btn-primary">Send</button>
        </form>
      </div>
    </${MainLayout}>
  `
}

function renderTestEmailHtml(text: string, language: 'en' | 'he'): string {
  const rendered = html`<html lang=${language} dir=${language === 'he' ? 'rtl' : 'ltr'}>
    <body style="font-family: sans-serif; line-height: 1.6; padding: 24px">
      <p style="white-space: pre-wrap">${text}</p>
    </body>
  </html>`
  return `<!doctype html>${Array.isArray(rendered) ? rendered.join('') : rendered}`
}
