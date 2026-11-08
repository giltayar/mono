import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'
import i18next from 'i18next'
import {z} from 'zod'
import {
  finalHtml,
  retarget,
  type ControllerResult,
} from '@giltayar/carmbo-commons/commons/controller-result'
import type {Banner} from '@giltayar/carmbo-commons/layout/banner'
import type {NowService} from '@giltayar/carmbo-commons/commons/now-service'
import type {EmailService} from '../emails/email-service.ts'
import {
  archiveTemplate,
  listTemplates,
  previewTemplate,
  queryTemplate,
  saveTemplate,
  sendPreview,
} from './model.ts'
import {
  draftFromForm,
  newTemplate,
  parseTemplateForm,
  type SendPreviewFormInput,
  type TemplateFormInput,
} from './schema.ts'
import {exportEmail, templateFromDraft} from './export.ts'
import {TemplateError} from './render.ts'
import {renderTemplateList} from './view/list.ts'
import {
  renderTemplateForm,
  renderTemplatePage,
  templatePath,
  type TemplatePage,
} from './view/create-update.ts'
import {renderTemplateSamples} from './view/samples.ts'
import {renderPreviewDialog, renderRawHtmlDialog, renderSendDialog} from './view/dialogs.ts'
import {labels} from './view/labels.ts'

export type TemplateServices = {
  sql: Sql
  nowService: NowService
  emailService: EmailService
  from: string
}

export async function showTemplates(
  filter: {query: string; page: number; withArchived: boolean},
  sql: Sql,
): Promise<ControllerResult> {
  return finalHtml(renderTemplateList(await listTemplates(filter, sql), filter))
}

export function showTemplateCreate(): ControllerResult {
  return finalHtml(
    renderTemplatePage(
      {
        number: undefined,
        draft: newTemplate(i18next.resolvedLanguage?.startsWith('he') ? 'he' : 'en'),
        revision: undefined,
        historical: false,
        history: [],
      },
      {banner: undefined},
    ),
  )
}

export async function showTemplateUpdate(
  number: number,
  historyId: string | undefined,
  sql: Sql,
): Promise<ControllerResult> {
  const page = await storedPage(number, historyId, sql)
  return page ? finalHtml(renderTemplatePage(page, {banner: undefined})) : notFound()
}

export async function createTemplate(
  input: TemplateFormInput,
  {sql, nowService}: TemplateServices,
  logger: FastifyBaseLogger,
): Promise<ControllerResult> {
  try {
    const template = await templateFromDraft(parseTemplateForm(input))
    return {htmxRedirect: templatePath(await saveTemplate(undefined, template, nowService(), sql))}
  } catch (error) {
    const page = {
      number: undefined,
      draft: draftFromForm(input),
      revision: undefined,
      historical: false,
      history: [],
    }
    return finalHtml(
      renderTemplatePage(page, {banner: errorBanner(error, 'create', undefined, logger)}),
    )
  }
}

export async function updateTemplate(
  number: number,
  input: TemplateFormInput,
  {sql, nowService}: TemplateServices,
  logger: FastifyBaseLogger,
): Promise<ControllerResult> {
  try {
    const template = await templateFromDraft(parseTemplateForm(input))
    return {htmxRedirect: templatePath(await saveTemplate(number, template, nowService(), sql))}
  } catch (error) {
    const banner = errorBanner(error, 'update', number, logger)
    const stored = await storedPage(number, undefined, sql)
    if (!stored) return notFound()
    const page: TemplatePage = {...stored, draft: draftFromForm(input)}
    if (stored.revision?.operation === 'delete') {
      return retarget(finalHtml(renderTemplatePage(stored, {banner})), 'body')
    }
    return finalHtml(renderTemplateForm(page), {banner})
  }
}

export async function deleteTemplate(
  number: number,
  operation: 'delete' | 'restore',
  {sql, nowService}: TemplateServices,
  logger: FastifyBaseLogger,
): Promise<ControllerResult> {
  try {
    await archiveTemplate(number, operation, nowService(), sql)
    return {htmxRedirect: templatePath(number)}
  } catch (error) {
    const banner = errorBanner(error, operation, number, logger)
    const page = await storedPage(number, undefined, sql)
    return page ? retarget(finalHtml(renderTemplatePage(page, {banner})), 'body') : notFound()
  }
}

export function showSamples(input: TemplateFormInput): ControllerResult {
  return finalHtml(renderTemplateSamples(draftFromForm(input)))
}

export async function showPreview(
  number: number | undefined,
  input: TemplateFormInput,
  sql: Sql,
  logger: FastifyBaseLogger,
): Promise<ControllerResult> {
  try {
    const template = await templateFromDraft(parseTemplateForm(input))
    return finalHtml(renderPreviewDialog(await previewTemplate(number, template, sql)))
  } catch (error) {
    return finalHtml(renderPreviewDialog({error: errorMessage(error, 'preview', number, logger)}))
  }
}

export async function showRawHtml(
  input: TemplateFormInput,
  logger: FastifyBaseLogger,
): Promise<ControllerResult> {
  try {
    const draft = draftFromForm(input)
    return finalHtml(
      renderRawHtmlDialog({html: await exportEmail(draft.editorDocument, draft.language)}),
    )
  } catch (error) {
    return finalHtml(
      renderRawHtmlDialog({error: errorMessage(error, 'raw-html', undefined, logger)}),
    )
  }
}

export async function showStoredRawHtml(
  number: number,
  historyId: string | undefined,
  sql: Sql,
): Promise<ControllerResult> {
  const page = await storedPage(number, historyId, sql)
  return page?.revision
    ? finalHtml(renderRawHtmlDialog({html: page.revision.template.html}))
    : notFound()
}

export function showSendDialog(number: number | undefined, recipient: string): ControllerResult {
  return finalHtml(
    renderSendDialog({
      path: templatePath(number),
      recipient,
      requestId: crypto.randomUUID(),
      error: undefined,
    }),
  )
}

export async function sendTemplatePreview(
  number: number | undefined,
  {to, requestId, ...input}: SendPreviewFormInput,
  services: TemplateServices,
  logger: FastifyBaseLogger,
): Promise<{sent: string} | {dialog: string}> {
  try {
    const template = await templateFromDraft(parseTemplateForm(input))
    await sendPreview(number, {template, to, requestId}, services.sql, services)
    return {
      sent: finalHtml('', {banner: {message: labels().accepted, type: 'info', disappearing: true}}),
    }
  } catch (error) {
    return {
      dialog: finalHtml(
        renderSendDialog({
          path: templatePath(number),
          recipient: to,
          requestId: z.uuid().safeParse(requestId).success ? requestId : crypto.randomUUID(),
          error: errorMessage(error, 'send', number, logger),
        }),
      ),
    }
  }
}

async function storedPage(
  number: number,
  historyId: string | undefined,
  sql: Sql,
): Promise<TemplatePage | undefined> {
  try {
    const {revision, history} = await queryTemplate(number, historyId, sql)
    return {
      number,
      draft: revision.template,
      revision,
      historical: historyId !== undefined,
      history,
    }
  } catch (error) {
    if (error instanceof TemplateError && error.code === 'notFound') return undefined
    throw error
  }
}

function notFound(): ControllerResult {
  return {status: 404, body: labels().notFound}
}

function errorMessage(
  error: unknown,
  operation: string,
  templateNumber: number | undefined,
  logger: FastifyBaseLogger,
): string {
  const code =
    error instanceof TemplateError
      ? error.code
      : error instanceof z.ZodError
        ? 'invalidTemplate'
        : 'unexpected'
  logger.error(
    {
      operation,
      templateNumber,
      errorCode: code,
      // Never log the error itself: it can include preview values or recipients.
      errorName: error instanceof Error ? error.name : 'unknown',
    },
    'email-template-operation-failed',
  )
  return code === 'archived' ? labels().archivedError : labels()[code]
}

function errorBanner(
  error: unknown,
  operation: string,
  templateNumber: number | undefined,
  logger: FastifyBaseLogger,
): Banner {
  return {
    message: errorMessage(error, operation, templateNumber, logger),
    type: 'error',
    disappearing: false,
  }
}
