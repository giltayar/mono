import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import z from 'zod'
import {createDatabaseBackup} from './controller.ts'

export default function (
  app: FastifyInstance,
  {
    secret,
    connectionString,
    backupFile,
  }: {
    secret: string | undefined
    connectionString: string | undefined
    backupFile: string | undefined
  },
): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.post(
    '/db-backup',
    {schema: {querystring: z.object({secret: z.string()})}},
    async (request, reply) => {
      if (secret && request.query.secret !== secret) {
        request.log.warn('wrong-api-secret')
        return reply.status(403).send({error: 'Forbidden'})
      }

      request.log.info({backupFile}, 'database-backup-started')
      await createDatabaseBackup(connectionString, backupFile)
      request.log.info({backupFile}, 'database-backup-completed')

      return {message: 'Database backup completed', backupFile}
    },
  )
}
