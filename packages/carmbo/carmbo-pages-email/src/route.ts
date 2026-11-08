import type {FastifyInstance} from 'fastify'
import {emailRoutes} from './emails/route.ts'
import {templateRoutes} from './templates/route.ts'
import type {TemplateServices} from './templates/controller.ts'

export function routes(app: FastifyInstance, options: TemplateServices): void {
  if (
    !options.emailService?.sendEmail ||
    !options.from?.trim() ||
    /[\r\n]/.test(options.from) ||
    !options.nowService
  ) {
    throw new Error('Email routes require emailService, from, and nowService')
  }
  app.register(emailRoutes, {sql: options.sql})
  app.register(templateRoutes, {...options, prefix: '/templates'})
}
