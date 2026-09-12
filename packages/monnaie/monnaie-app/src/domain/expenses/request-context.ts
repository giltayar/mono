import {requestContext} from '@fastify/request-context'
import type {ExpensesQuery} from './model.ts'

declare module '@fastify/request-context' {
  interface RequestContextData {
    expenseQuery: ExpensesQuery | undefined
    expenseQueryString: string | undefined
    savedExpenseId: number
    timeZone: string
  }
}

export function setExpenseRequestContext(
  expenseQuery: ExpensesQuery,
  expenseQueryString: string,
  savedExpenseId: number,
): void {
  requestContext.set('expenseQuery', expenseQuery)
  requestContext.set('expenseQueryString', expenseQueryString)
  requestContext.set('savedExpenseId', savedExpenseId)
}

export function currentExpenseQuery(): ExpensesQuery {
  const expenseQuery = requestContext.get('expenseQuery')

  if (expenseQuery === undefined) {
    throw new Error('no expense query in the current request')
  }

  return expenseQuery
}

export function currentSavedExpenseId(): number {
  return requestContext.get('savedExpenseId') ?? 0
}

export function currentExpenseQueryString(): string {
  const expenseQueryString = requestContext.get('expenseQueryString')

  if (expenseQueryString === undefined) {
    throw new Error('no expense query string in the current request')
  }

  return expenseQueryString
}

export function currentTimeZone(): string {
  const timeZone = requestContext.get('timeZone')

  if (timeZone === undefined) {
    throw new Error('no timezone in the current request')
  }

  return timeZone
}
