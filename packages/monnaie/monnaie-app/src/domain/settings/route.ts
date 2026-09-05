import type {FastifyInstance} from 'fastify'
import {replyWithControllerResult} from '../../commons/controller.ts'
import {showSettingsPage} from './controller.ts'

export default function settingsRoutes(app: FastifyInstance): void {
  app.get('/settings', async (_request, reply) =>
    replyWithControllerResult(reply, await showSettingsPage()),
  )
}
