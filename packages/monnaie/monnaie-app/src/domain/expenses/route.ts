import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import * as z from 'zod'
import type {Db} from '../../commons/db.ts'
import {authenticatedUser} from '../../commons/auth.ts'
import {replyWithControllerResult} from '../../commons/controller.ts'
import {
  addExpense,
  copyRecurring,
  removeExpense,
  saveExpenseEdit,
  showEditExpensePage,
  showExpensesPage,
  showGraphsPage,
  showNewExpensePage,
  showCopyRecurringDialog,
} from './controller.ts'
import {parseCategoryFilter, parseExpenseIds, parseExpenseTypeFilter} from './model.ts'

// the model is what validates these, so that the same rules apply however they arrive
const ExpenseBodySchema = z.object({
  description: z.string(),
  amount: z.string(),
  categoryId: z.string(),
  expenseType: z.string(),
})

// a single `?category=3` arrives as a string and repeated ones as an array; the ids themselves are
// the model's to judge, since a bookmarked URL may name a category that no longer exists
const CategoryFilterQuerySchema = z.object({
  category: z
    .union([z.string(), z.array(z.string())])
    .default([])
    .transform((category) => (Array.isArray(category) ? category : [category])),
  expenseType: z
    .union([z.string(), z.array(z.string())])
    .default([])
    .transform((expenseType) => (Array.isArray(expenseType) ? expenseType : [expenseType])),
  day: z.iso.date().optional(),
})

const EditExpenseBodySchema = z.object({
  description: z.string(),
  amount: z.string(),
  categoryId: z.string(),
  expenseType: z.string(),
  date: z.string(),
})

const CopyRecurringBodySchema = z.object({
  expenseId: z
    .union([z.string(), z.array(z.string())])
    .default([])
    .transform((expenseId) => (Array.isArray(expenseId) ? expenseId : [expenseId])),
  date: z.iso.date(),
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
          parseExpenseTypeFilter(request.query.expenseType),
          request.query.day,
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
          parseExpenseTypeFilter(request.query.expenseType),
          request.query.day,
          request.headers['hx-target'] === 'expense-month' ? 'expense-month' : 'page',
        ),
      ),
  )

  appWithTypes.get(
    '/expenses/new',
    {schema: {querystring: CategoryFilterQuerySchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        showNewExpensePage(
          parseCategoryFilter(request.query.category),
          parseExpenseTypeFilter(request.query.expenseType),
          request.query.day,
        ),
      ),
  )

  appWithTypes.post(
    '/expenses',
    {schema: {body: ExpenseBodySchema, querystring: CategoryFilterQuerySchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await addExpense(
          db,
          authenticatedUser().uid,
          {...request.body, date: undefined},
          parseCategoryFilter(request.query.category),
          parseExpenseTypeFilter(request.query.expenseType),
          request.query.day,
        ),
      ),
  )

  appWithTypes.get('/expenses/copy-recurring', async (_request, reply) =>
    replyWithControllerResult(
      reply,
      await showCopyRecurringDialog(db, authenticatedUser().uid, timeZone),
    ),
  )

  appWithTypes.post(
    '/expenses/copy-recurring',
    {schema: {body: CopyRecurringBodySchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await copyRecurring(
          db,
          authenticatedUser().uid,
          timeZone,
          parseExpenseIds(request.body.expenseId),
          request.body.date,
        ),
      ),
  )

  appWithTypes.get(
    '/expenses/:id/edit',
    {schema: {params: ExpenseParamsSchema, querystring: CategoryFilterQuerySchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await showEditExpensePage(
          db,
          authenticatedUser().uid,
          request.params.id,
          timeZone,
          parseCategoryFilter(request.query.category),
          parseExpenseTypeFilter(request.query.expenseType),
          request.query.day,
        ),
      ),
  )

  appWithTypes.post(
    '/expenses/:id',
    {
      schema: {
        params: ExpenseParamsSchema,
        body: EditExpenseBodySchema,
        querystring: CategoryFilterQuerySchema,
      },
    },
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await saveExpenseEdit(
          db,
          authenticatedUser().uid,
          request.params.id,
          request.body,
          timeZone,
          parseCategoryFilter(request.query.category),
          parseExpenseTypeFilter(request.query.expenseType),
          request.query.day,
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
          parseExpenseTypeFilter(request.query.expenseType),
          request.query.day,
        ),
      ),
  )
}
