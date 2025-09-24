import {
  showStudentCreate,
  showStudentInHistory,
  showStudents,
  showStudentUpdate,
  createStudent,
  updateStudent,
  showOngoingStudent,
  deleteStudent,
} from './controller.ts'
import {NewStudentSchema, StudentSchema} from './model.ts'
import assert from 'node:assert'
import type {FastifyInstance} from 'fastify'
import type {Sql} from 'postgres'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import z from 'zod'
import {dealWithControllerResult} from '../commons/routes-commons.ts'

export default function (app: FastifyInstance, {sql}: {sql: Sql}) {
  // List students
  app.get<{Querystring: {flash: string; 'with-archived': string}}>('/', async (request, reply) =>
    dealWithControllerResult(
      reply,
      await showStudents(
        {flash: request.query.flash, withArchived: 'with-archived' in request.query},
        sql,
      ),
    ),
  )

  // Create new student
  app.get('/new', async (_request, reply) => dealWithControllerResult(reply, showStudentCreate()))

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/new', {schema: {body: NewStudentSchema}}, async (request, reply) =>
      dealWithControllerResult(
        reply,
        showOngoingStudent(request.body, {addItem: request.headers['x-add-item']}),
      ),
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/', {schema: {body: NewStudentSchema}}, async (request, reply) => {
      return dealWithControllerResult(reply, await createStudent(request.body, sql))
    })

  // Edit existing student
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/:number',
      {schema: {params: z.object({number: z.coerce.number().int()})}},
      async (request, reply) => {
        return dealWithControllerResult(
          reply,
          await showStudentUpdate(
            request.params.number,
            {addItem: request.headers['x-add-item']},
            sql,
          ),
        )
      },
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/:number',
      {schema: {body: StudentSchema, params: z.object({number: z.coerce.number().int()})}},
      async (request, reply) => {
        const studentNumber = request.params.number

        assert(
          studentNumber === request.body.studentNumber,
          'student number in URL must match ID in body',
        )

        return dealWithControllerResult(
          reply,
          showOngoingStudent(request.body, {addItem: request.headers['x-add-item']}),
        )
      },
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .put(
      '/:number',
      {schema: {body: StudentSchema, params: z.object({number: z.coerce.number().int()})}},
      async (request, reply) => {
        const studentNumber = request.params.number

        assert(
          studentNumber === request.body.studentNumber,
          'student number in URL must match ID in body',
        )

        return dealWithControllerResult(reply, await updateStudent(request.body, sql))
      },
    )

  // View student in history
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:number/by-history/:operationId',
    {
      schema: {
        params: z.object({number: z.coerce.number().int(), operationId: z.uuid()}),
      },
    },
    async (request, reply) => {
      return dealWithControllerResult(
        reply,
        await showStudentInHistory(request.params.number, request.params.operationId, sql),
      )
    },
  )

  // Delete (Archive) student
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete(
      '/:number',
      {schema: {params: z.object({number: z.coerce.number().int()})}},
      async (request, reply) =>
        dealWithControllerResult(reply, await deleteStudent(request.params.number, sql)),
    )
}
