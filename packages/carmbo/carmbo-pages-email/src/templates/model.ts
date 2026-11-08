import {createHash} from 'node:crypto'
import type {Sql, TransactionSql} from 'postgres'
import {z} from 'zod'
import {sqlTextSearch} from '@giltayar/carmbo-commons/commons/sql-commons'
import type {EmailService} from '../emails/email-service.ts'
import {
  TEMPLATE_PAGE_SIZE,
  TemplateSchema,
  templateNumberSchema,
  type Template,
  type TemplateHistory,
  type TemplateRevision,
  type TemplateOperation,
} from './schema.ts'
import {renderTemplate, TemplateError, validateTemplates} from './render.ts'

type Row = Template & {
  emailTemplateNumber: number
  id: string
  operation: TemplateOperation
}
export type TemplateListItem = {
  number: number
  name: string
  description: string
  archived: boolean
}

export async function listTemplates(
  input: {query: string; page: number; withArchived: boolean},
  sql: Sql,
): Promise<TemplateListItem[]> {
  const {query, page, withArchived} = z
    .object({
      query: z.string().max(1000),
      page: z.number().int().nonnegative(),
      withArchived: z.boolean(),
    })
    .parse(input)
  return sql<TemplateListItem[]>`
    SELECT t.email_template_number AS number, d.name, d.description,
      h.operation = 'delete' AS archived
    FROM email_template t
    JOIN email_template_history h ON h.id = t.last_history_id
    JOIN email_template_data d ON d.data_id = t.last_data_id
    JOIN email_template_search s ON s.data_id = d.data_id
    WHERE (${withArchived} OR h.operation <> 'delete')
      ${query ? sql`AND s.searchable_text ${sqlTextSearch(query, sql)}` : sql``}
    ORDER BY t.email_template_number DESC
    LIMIT ${TEMPLATE_PAGE_SIZE} OFFSET ${page * TEMPLATE_PAGE_SIZE}
  `
}

export async function queryTemplate(
  number: number,
  historyId: string | undefined,
  sql: Sql,
): Promise<{revision: TemplateRevision; history: TemplateHistory[]}> {
  templateNumberSchema.parse(number)
  if (historyId !== undefined) z.uuid().parse(historyId)
  const [row] = await sql<Row[]>`
    SELECT d.*, h.id, h.operation
    FROM email_template t
    JOIN email_template_history h ON h.email_template_number = t.email_template_number
      AND h.id = ${historyId === undefined ? sql`t.last_history_id` : sql`${historyId}`}
    JOIN email_template_data d ON d.data_id = h.data_id
      AND d.email_template_number = t.email_template_number
    WHERE t.email_template_number = ${number}
  `
  if (!row) throw new TemplateError('notFound', undefined)
  const history = await sql<TemplateHistory[]>`
    SELECT id, timestamp, operation FROM email_template_history
    WHERE email_template_number = ${number} ORDER BY timestamp DESC, id
  `
  return {
    revision: {
      number,
      historyId: row.id,
      operation: row.operation,
      template: TemplateSchema.parse(row),
    },
    history,
  }
}

export async function saveTemplate(
  number: number | undefined,
  input: Template,
  now: Date,
  sql: Sql,
): Promise<number> {
  const template = TemplateSchema.parse(input)
  validateTemplates(template)
  z.date().parse(now)
  if (number !== undefined) templateNumberSchema.parse(number)
  return sql.begin(async (tx) => {
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()
    let templateNumber: number
    if (number === undefined) {
      const [row] = await tx<{number: number}[]>`
        INSERT INTO email_template (last_history_id, last_data_id) VALUES (${historyId}, ${dataId})
        RETURNING email_template_number AS number
      `
      templateNumber = row.number
    } else {
      await assertWritable(number, tx)
      templateNumber = number
      await tx`UPDATE email_template SET last_history_id = ${historyId}, last_data_id = ${dataId}
        WHERE email_template_number = ${number}`
    }
    await tx`
      INSERT INTO email_template_data
        (data_id, email_template_number, name, description, subject, text, html, language,
          editor_document, editor_document_version, preview_values)
      VALUES (${dataId}, ${templateNumber}, ${template.name}, ${template.description},
        ${template.subject}, ${template.text}, ${template.html}, ${template.language},
        ${tx.json(z.json().parse(template.editorDocument))},
        ${template.editorDocumentVersion}, ${tx.json(template.previewValues)})
    `
    await tx`INSERT INTO email_template_search (data_id, searchable_text)
      VALUES (${dataId}, ${`${template.name} ${template.description}`})`
    await tx`INSERT INTO email_template_history
      (id, email_template_number, data_id, timestamp, operation)
      VALUES (${historyId}, ${templateNumber}, ${dataId}, ${now},
        ${number === undefined ? 'create' : 'update'})`
    return templateNumber
  })
}

async function lockTemplate(number: number, tx: TransactionSql) {
  const [row] = await tx<{lastDataId: string; lastHistoryId: string}[]>`
    SELECT last_data_id, last_history_id FROM email_template
    WHERE email_template_number = ${number} FOR UPDATE
  `
  if (!row) throw new TemplateError('notFound', undefined)
  // Read history after acquiring the lock, so a concurrent archive cannot leave a stale join.
  const [history] = await tx<{operation: TemplateOperation}[]>`
    SELECT operation FROM email_template_history WHERE id = ${row.lastHistoryId}
  `
  if (!history) throw new Error('Email template history is missing')
  return {lastDataId: row.lastDataId, operation: history.operation}
}

async function assertWritable(number: number, tx: TransactionSql): Promise<void> {
  if ((await lockTemplate(number, tx)).operation === 'delete') {
    throw new TemplateError('archived', undefined)
  }
}

export async function archiveTemplate(
  number: number,
  operation: 'delete' | 'restore',
  now: Date,
  sql: Sql,
): Promise<void> {
  templateNumberSchema.parse(number)
  z.enum(['delete', 'restore']).parse(operation)
  z.date().parse(now)
  await sql.begin(async (tx) => {
    const current = await lockTemplate(number, tx)
    if ((current.operation === 'delete') === (operation === 'delete')) return
    const id = crypto.randomUUID()
    await tx`INSERT INTO email_template_history
      (id, email_template_number, data_id, timestamp, operation)
      VALUES (${id}, ${number}, ${current.lastDataId}, ${now}, ${operation})`
    await tx`UPDATE email_template SET last_history_id = ${id} WHERE email_template_number = ${number}`
  })
}

export async function previewTemplate(
  number: number | undefined,
  template: Template,
  sql: Sql,
): Promise<ReturnType<typeof renderTemplate>> {
  if (number !== undefined) {
    const {revision} = await queryTemplate(number, undefined, sql)
    if (revision.operation === 'delete') throw new TemplateError('archived', undefined)
  }
  return renderTemplate(template)
}

export async function sendPreview(
  number: number | undefined,
  input: {template: Template; to: string; requestId: string},
  sql: Sql,
  service: {emailService: EmailService; from: string},
): Promise<void> {
  const {template, to, requestId} = z
    .object({
      template: TemplateSchema,
      to: z.email(),
      requestId: z.uuid(),
    })
    .parse(input)
  const rendered = await previewTemplate(number, template, sql)
  try {
    const result = await service.emailService.sendEmail(
      {from: service.from, to, ...rendered, tags: {purpose: 'template-preview'}},
      // Retries of a dialog's request reuse the key; changed content or recipient never collide.
      {
        idempotencyKey: `template-preview/${requestId}/${createHash('sha256')
          .update(JSON.stringify([to, rendered]))
          .digest('hex')}`,
      },
    )
    if (!result?.id) throw new Error('Email provider returned no email ID')
  } catch (cause) {
    throw new TemplateError('sendFailed', {cause})
  }
}
