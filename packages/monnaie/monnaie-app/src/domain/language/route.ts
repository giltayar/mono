import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import * as z from 'zod'
import {replyWithControllerResult} from '../../commons/controller.ts'
import type {Db} from '../../commons/db.ts'
import {SUPPORTED_LANGUAGES} from '../../commons/i18n.ts'
import {switchLanguage} from './controller.ts'

export default function languageRoutes(app: FastifyInstance, {db}: {db: Db}): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.post(
    '/language',
    {schema: {body: z.object({language: z.enum(SUPPORTED_LANGUAGES)})}},
    async (request, reply) =>
      replyWithControllerResult(reply, await switchLanguage(db, request.body.language)),
  )
}
