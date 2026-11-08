import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'
import i18next from 'i18next'
import {z} from 'zod'
import {finalHtml, type ControllerResult} from '@giltayar/carmbo-commons/commons/controller-result'
import type {NowService} from '@giltayar/carmbo-commons/commons/now-service'
import type {EmailService} from '../email-service.ts'
import {
  archiveTemplate,
  listTemplates,
  previewTemplate,
  queryTemplate,
  saveTemplate,
  sendPreview,
} from './model.ts'
import {newTemplate, type Template} from './schema.ts'
import {labels, renderTemplateList, renderTemplatePage} from './view.ts'
import {TemplateError} from './render.ts'

export type TemplateServices = {
  sql: Sql
  nowService: NowService
  emailService: EmailService
  from: string
}
export type TemplateAction =
  | {type: 'save'; template: Template}
  | {type: 'preview'; template: Template}
  | {type: 'send'; template: Template; to: string; requestId: string}
  | {type: 'archive'; operation: 'delete' | 'restore'}

export async function showTemplates(
  filter: {query: string; page: number; withArchived: boolean},
  sql: Sql,
): Promise<ControllerResult> {
  return finalHtml(renderTemplateList(await listTemplates(filter, sql), filter))
}

export async function showTemplate(
  number: number | undefined,
  historyId: string | undefined,
  sql: Sql,
): Promise<ControllerResult> {
  if (number === undefined) {
    return finalHtml(
      renderTemplatePage(
        newTemplate(i18next.resolvedLanguage?.startsWith('he') ? 'he' : 'en'),
        undefined,
        false,
        [],
      ),
    )
  }
  try {
    const {revision, history} = await queryTemplate(number, historyId, sql)
    return finalHtml(
      renderTemplatePage(revision.template, revision, historyId !== undefined, history),
    )
  } catch (error) {
    if (error instanceof TemplateError && error.code === 'notFound') {
      return {status: 404, body: labels().notFound}
    }
    throw error
  }
}

export async function templateAction(
  number: number | undefined,
  action: TemplateAction,
  services: TemplateServices,
  logger: FastifyBaseLogger,
): Promise<{status: number; body: string}> {
  try {
    switch (action.type) {
      case 'save': {
        const savedNumber = await saveTemplate(
          number,
          action.template,
          services.nowService(),
          services.sql,
        )
        return {status: 200, body: JSON.stringify({redirect: `/emails/templates/${savedNumber}`})}
      }
      case 'preview':
        return {
          status: 200,
          body: JSON.stringify(await previewTemplate(number, action.template, services.sql)),
        }
      case 'send':
        await sendPreview(number, action, services.sql, services)
        return {status: 200, body: JSON.stringify({message: labels().accepted})}
      case 'archive':
        if (number === undefined) throw new TemplateError('notFound', undefined)
        await archiveTemplate(number, action.operation, services.nowService(), services.sql)
        return {status: 200, body: JSON.stringify({redirect: `/emails/templates/${number}`})}
    }
  } catch (error) {
    const code =
      error instanceof TemplateError
        ? error.code
        : error instanceof z.ZodError
          ? 'invalidTemplate'
          : 'unexpected'
    logger.error(
      {operation: action.type, templateNumber: number, errorCode: code},
      'email-template-operation-failed',
    )
    const message = code === 'archived' ? labels().archivedError : labels()[code]
    return {
      status:
        code === 'notFound'
          ? 404
          : code === 'archived'
            ? 409
            : code === 'sendFailed'
              ? 502
              : code === 'unexpected'
                ? 500
                : 400,
      body: JSON.stringify({error: message}),
    }
  }
}
