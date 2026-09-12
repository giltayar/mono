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
import {parseExpenseIds, parseExpenseQuery} from './model.ts'
import {setExpenseRequestContext} from './request-context.ts'

// the model is what validates these, so that the same rules apply however they arrive
const ExpenseBodySchema = z.object({
  description: z.string(),
  amount: z.string(),
  categoryId: z.string(),
  expenseType: z.string(),
})

// a single `?category=3` arrives as a string and repeated ones as an array; the ids themselves are
// the model's to judge, since a bookmarked URL may name a category that no longer exists
const ExpenseQuerySchema = z
  .object({
    category: z
      .union([z.string(), z.array(z.string())])
      .default([])
      .transform((category) => (Array.isArray(category) ? category : [category])),
    expenseType: z
      .union([z.string(), z.array(z.string())])
      .default([])
      .transform((expenseType) => (Array.isArray(expenseType) ? expenseType : [expenseType])),
    title: z.string().default(''),
    day: z.iso.date().optional(),
    savedExpense: z.coerce.number().int().positive().catch(0),
  })
  .transform((query) => ({...query, day: query.day}))

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
})

const ExpenseParamsSchema = z.object({id: z.coerce.number().int()})

export default function expensesRoutes(app: FastifyInstance, {db}: {db: Db}): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get('/', {schema: {querystring: ExpenseQuerySchema}}, async (request, reply) => {
    const expenseQuery = initializeExpenseRequestContext(request.query, rawQueryString(request.url))

    return replyWithControllerResult(
      reply,
      await showExpensesPage(
        db,
        authenticatedUser().uid,
        expenseQuery,
        request.headers['hx-target'] === 'expense-month' ? 'expense-month' : 'page',
      ),
    )
  })

  appWithTypes.get(
    '/expenses/graphs',
    {schema: {querystring: ExpenseQuerySchema}},
    async (request, reply) => {
      const expenseQuery = initializeExpenseRequestContext(
        request.query,
        rawQueryString(request.url),
      )

      return replyWithControllerResult(
        reply,
        await showGraphsPage(
          db,
          authenticatedUser().uid,
          expenseQuery,
          request.headers['hx-target'] === 'expense-month' ? 'expense-month' : 'page',
        ),
      )
    },
  )

  appWithTypes.get(
    '/expenses/new',
    {schema: {querystring: ExpenseQuerySchema}},
    async (request, reply) => {
      initializeExpenseRequestContext(request.query, rawQueryString(request.url))

      return replyWithControllerResult(reply, showNewExpensePage())
    },
  )

  appWithTypes.post(
    '/expenses',
    {schema: {body: ExpenseBodySchema, querystring: ExpenseQuerySchema}},
    async (request, reply) => {
      initializeExpenseRequestContext(request.query, rawQueryString(request.url))

      return replyWithControllerResult(
        reply,
        await addExpense(db, authenticatedUser().uid, {
          description: request.body.description,
          amount: request.body.amount,
          categoryId: request.body.categoryId,
          expenseType: request.body.expenseType,
          date: undefined,
        }),
      )
    },
  )

  appWithTypes.get('/expenses/copy-recurring', async (_request, reply) =>
    replyWithControllerResult(reply, await showCopyRecurringDialog(db, authenticatedUser().uid)),
  )

  appWithTypes.post(
    '/expenses/copy-recurring',
    {schema: {body: CopyRecurringBodySchema}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await copyRecurring(db, authenticatedUser().uid, parseExpenseIds(request.body.expenseId)),
      ),
  )

  appWithTypes.get(
    '/expenses/:id/edit',
    {schema: {params: ExpenseParamsSchema, querystring: ExpenseQuerySchema}},
    async (request, reply) => {
      initializeExpenseRequestContext(request.query, rawQueryString(request.url))

      return replyWithControllerResult(
        reply,
        await showEditExpensePage(db, authenticatedUser().uid, request.params.id),
      )
    },
  )

  appWithTypes.post(
    '/expenses/:id',
    {
      schema: {
        params: ExpenseParamsSchema,
        body: EditExpenseBodySchema,
        querystring: ExpenseQuerySchema,
      },
    },
    async (request, reply) => {
      initializeExpenseRequestContext(request.query, rawQueryString(request.url))

      return replyWithControllerResult(
        reply,
        await saveExpenseEdit(db, authenticatedUser().uid, request.params.id, request.body),
      )
    },
  )

  appWithTypes.delete(
    '/expenses/:id',
    {schema: {params: ExpenseParamsSchema, querystring: ExpenseQuerySchema}},
    async (request, reply) => {
      const expenseQuery = initializeExpenseRequestContext(
        request.query,
        rawQueryString(request.url),
      )

      return replyWithControllerResult(
        reply,
        await removeExpense(db, authenticatedUser().uid, request.params.id, expenseQuery),
      )
    },
  )
}

function initializeExpenseRequestContext(
  query: z.output<typeof ExpenseQuerySchema>,
  queryString: string,
): ReturnType<typeof parseExpenseQuery> {
  const expenseQuery = parseExpenseQuery(query)
  setExpenseRequestContext(expenseQuery, queryString, query.savedExpense)

  return expenseQuery
}

function rawQueryString(url: string): string {
  const queryStart = url.indexOf('?')

  return queryStart === -1 ? '' : url.slice(queryStart)
}
