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
  showGraphsPage,
  showNewExpensePage,
} from './controller.ts'
import {parseCategoryFilter} from './model.ts'

// the model is what validates these, so that the same rules apply however they arrive
const ExpenseBodySchema = z.object({
  description: z.string(),
  amount: z.string(),
  categoryId: z.string(),
})

// a single `?category=3` arrives as a string and repeated ones as an array; the ids themselves are
// the model's to judge, since a bookmarked URL may name a category that no longer exists
const CategoryFilterQuerySchema = z.object({
  category: z
    .union([z.string(), z.array(z.string())])
    .default([])
    .transform((category) => (Array.isArray(category) ? category : [category])),
})

const EditExpenseBodySchema = z.object({
  description: z.string(),
  amount: z.string(),
  categoryId: z.string(),
  date: z.string(),
})

const ExpenseParamsSchema = z.object({id: z.coerce.number().int()})

export default function expensesRoutes(
  app: FastifyInstance,
  {db, timeZone}: {db: Db; timeZone: string},
): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get(
    '/',
    {schema: {querystring: CategoryFilterQuerySchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await showExpensesPage(
          db,
          authenticatedUser().uid,
          timeZone,
          parseCategoryFilter(request.query.category),
          request.headers['hx-target'] === 'expense-month' ? 'expense-month' : 'page',
        ),
      ),
  )

  appWithTypes.get(
    '/expenses/graphs',
    {schema: {querystring: CategoryFilterQuerySchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await showGraphsPage(
          db,
          authenticatedUser().uid,
          timeZone,
          parseCategoryFilter(request.query.category),
          request.headers['hx-target'] === 'expense-month' ? 'expense-month' : 'page',
        ),
      ),
  )

  appWithTypes.get('/expenses/new', async (_request, reply) =>
    replyWithControllerResult(reply, showNewExpensePage()),
  )

  appWithTypes.post('/expenses', {schema: {body: ExpenseBodySchema}}, async (request, reply) =>
    replyWithControllerResult(
      reply,
      await addExpense(db, authenticatedUser().uid, {...request.body, date: undefined}),
    ),
  )

  appWithTypes.get(
    '/expenses/:id/edit',
    {schema: {params: ExpenseParamsSchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await showEditExpensePage(db, authenticatedUser().uid, request.params.id, timeZone),
      ),
  )

  appWithTypes.post(
    '/expenses/:id',
    {schema: {params: ExpenseParamsSchema, body: EditExpenseBodySchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await saveExpenseEdit(
          db,
          authenticatedUser().uid,
          request.params.id,
          request.body,
          timeZone,
        ),
      ),
  )

  appWithTypes.delete(
    '/expenses/:id',
    {schema: {params: ExpenseParamsSchema, querystring: CategoryFilterQuerySchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await removeExpense(
          db,
          authenticatedUser().uid,
          request.params.id,
          timeZone,
          parseCategoryFilter(request.query.category),
        ),
      ),
  )
}
