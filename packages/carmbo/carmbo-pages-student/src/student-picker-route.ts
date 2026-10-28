import type {FastifyInstance, FastifyReply} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import {z} from 'zod'
import {finalHtml} from '@giltayar/carmbo-commons/commons/controller-result'
import {generateItemTitle} from '@giltayar/carmbo-commons/commons/view-commons'
import type {StudentRouteOptions} from './student-route-options.ts'
import {PickerStudentViewSchema, PickerTargetSchema} from './view/student-picker-model.ts'
import {renderStudentPickerDialog, studentPickerStyles} from './view/student-picker.ts'
import {
  createPickerStudent,
  searchPickerStudents,
  selectPickerStudent,
  type PickerResult,
} from './student-picker-controller.ts'

function sendPickerResult(reply: FastifyReply, targetFieldId: string, result: PickerResult): void {
  if ('selected' in result) {
    const trigger = JSON.stringify({
      'student-picker-selected': {
        targetFieldId,
        student: result.selected,
        value: generateItemTitle(result.selected.studentNumber, result.selected.name),
      },
    })
    // HTTP headers must remain ASCII, including when a student's name is in Hebrew.
    const header = trigger.replace(
      /[\u007f-\uffff]/g,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
    )
    reply.header('HX-Trigger', header).code(204).send()
  } else {
    reply
      .header('HX-Retarget', `#${targetFieldId}-student-picker-container`)
      .header('HX-Reswap', 'innerHTML')
      .type('text/html')
      .send(result.body)
  }
}

export function registerStudentPickerRoutes(
  app: FastifyInstance,
  options: StudentRouteOptions,
): void {
  const basePath = app.prefix
  const typed = app.withTypeProvider<ZodTypeProvider>()
  const query = z.object({targetFieldId: PickerTargetSchema})
  app.get('/picker.css', async (_request, reply) =>
    reply.type('text/css; charset=utf-8').send(studentPickerStyles),
  )
  typed.get('/picker', {schema: {querystring: query}}, async (request, reply) =>
    reply.type('text/html').send(
      finalHtml(
        renderStudentPickerDialog({
          basePath,
          targetFieldId: request.query.targetFieldId,
        }),
      ),
    ),
  )
  typed.get(
    '/picker/search',
    {
      schema: {querystring: query.extend({q: z.string().default('')})},
    },
    async (request, reply) =>
      reply.type('text/html').send(
        await searchPickerStudents(
          {
            basePath,
            targetFieldId: request.query.targetFieldId,
          },
          request.query.q,
          options.sql,
        ),
      ),
  )
  typed.post(
    '/picker/select',
    {
      schema: {
        querystring: query,
        body: z.object({studentNumber: z.coerce.number().int().positive()}),
      },
    },
    async (request, reply) => {
      const {targetFieldId} = request.query
      sendPickerResult(
        reply,
        targetFieldId,
        await selectPickerStudent(
          {basePath, targetFieldId},
          request.body.studentNumber,
          options.sql,
          {...options, logger: request.log},
        ),
      )
    },
  )
  typed.post(
    '/picker/create',
    {
      schema: {querystring: query, body: PickerStudentViewSchema},
    },
    async (request, reply) => {
      const {targetFieldId} = request.query
      sendPickerResult(
        reply,
        targetFieldId,
        await createPickerStudent({basePath, targetFieldId}, request.body, options.sql, {
          ...options,
          logger: request.log,
        }),
      )
    },
  )
}
