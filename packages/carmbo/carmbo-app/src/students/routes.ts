import {showStudentCreate, showStudents, showStudentUpdate} from './controller.ts'
import {
  createStudent,
  fetchStudentByNumber,
  NewStudentSchema,
  StudentSchema,
  updateStudent,
} from './model.ts'
import assert from 'node:assert'
import type {FastifyInstance} from 'fastify'
import type {Sql} from 'postgres'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import z from 'zod'

export default function (app: FastifyInstance, {sql}: {sql: Sql}) {
  app.addHook('preHandler', (_request, reply, done) => {
    reply.type('text/html')
    done()
  })

  // List students
  app.get<{Querystring: {flash: string}}>('/', async (request) =>
    showStudents({flash: request.query.flash}, sql),
  )

  // Create new student
  app.get('/new', async () => showStudentCreate(undefined, undefined))

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/new', {schema: {body: NewStudentSchema}}, async (request) =>
      showStudentCreate(request.body, {
        removeItem: request.headers['x-remove-item'],
        removeIndex: request.headers['x-remove-index'],
        addItem: request.headers['x-add-item'],
      }),
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/', {schema: {body: NewStudentSchema}}, async (request, reply) => {
      const studentNumber = await createStudent(request.body, undefined, sql)

      if (!studentNumber) {
        return reply.status(404).send('Student not found')
      }

      reply.header('HX-Redirect', `/students/${studentNumber}`)
    })

  // Edit existing student
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/:number',
      {schema: {params: z.object({number: z.coerce.number().int()})}},
      async (request, reply) => {
        const student = await fetchStudentByNumber(request.params.number, sql)

        if (!student) {
          return reply.status(404).send('Student not found')
        }

        return showStudentUpdate(student, {
          removeItem: request.headers['x-remove-item'],
          removeIndex: request.headers['x-remove-index'],
          addItem: request.headers['x-add-item'],
        })
      },
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/:number',
      {schema: {body: StudentSchema, params: z.object({number: z.coerce.number().int()})}},
      async (request) => {
        const studentNumber = request.params.number

        assert(
          studentNumber === request.body.studentNumber,
          'student number in URL must match ID in body',
        )

        return showStudentUpdate(request.body, {
          removeItem: request.headers['x-remove-item'],
          removeIndex: request.headers['x-remove-index'],
          addItem: request.headers['x-add-item'],
        })
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

        await updateStudent(request.body, undefined, sql)

        reply.header('HX-Redirect', `/students/${studentNumber}`)
      },
    )
}
