import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import * as z from 'zod'
import type {Db} from '../../commons/db.ts'
import {authenticatedUser} from '../../commons/auth.ts'
import {replyWithControllerResult} from '../../commons/controller.ts'
import {
  addExpense,
  removeExpense,
  saveExpenseEdit,
  showEditExpensePage,
  showExpensesPage,
  showNewExpensePage,
} from './controller.ts'

// the model is what validates these, so that the same rules apply however they arrive
const ExpenseBodySchema = z.object({
  description: z.string(),
  amount: z.string(),
  categoryId: z.string(),
})

const ExpenseParamsSchema = z.object({id: z.coerce.number().int()})

export default function expensesRoutes(
  app: FastifyInstance,
  {db, timeZone}: {db: Db; timeZone: string},
): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get('/', async (_request, reply) =>
    replyWithControllerResult(reply, await showExpensesPage(db, authenticatedUser().uid, timeZone)),
  )

  appWithTypes.get('/expenses/new', async (_request, reply) =>
    replyWithControllerResult(reply, showNewExpensePage()),
  )

  appWithTypes.post('/expenses', {schema: {body: ExpenseBodySchema}}, async (request, reply) =>
    replyWithControllerResult(reply, await addExpense(db, authenticatedUser().uid, request.body)),
  )

  appWithTypes.get(
    '/expenses/:id/edit',
    {schema: {params: ExpenseParamsSchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await showEditExpensePage(db, authenticatedUser().uid, request.params.id),
      ),
  )

  appWithTypes.post(
    '/expenses/:id',
    {schema: {params: ExpenseParamsSchema, body: ExpenseBodySchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await saveExpenseEdit(db, authenticatedUser().uid, request.params.id, request.body),
      ),
  )

  appWithTypes.delete(
    '/expenses/:id',
    {schema: {params: ExpenseParamsSchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await removeExpense(db, authenticatedUser().uid, request.params.id, timeZone),
      ),
  )
}
