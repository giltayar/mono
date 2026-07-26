import type {Db} from '../../commons/db.ts'

/** Translated by the view layer, so that the model has no display text in it */
export type CalculationError = 'empty' | 'invalid'

export type CalculationResult = {value: string} | {error: CalculationError}

export type Calculation = {id: number; expression: string; value: string}

type Operator = '+' | '-' | '*' | '/'

const CALCULATION_REGEX = /^\s*(-?\d+(?:\.\d+)?)\s*(?:([-+*/])\s*(-?\d+(?:\.\d+)?)\s*)?$/

export function calculate(expression: string): CalculationResult {
  if (expression.trim() === '') {
    return {error: 'empty'}
  }

  const match = CALCULATION_REGEX.exec(expression)

  if (match === null) {
    return {error: 'invalid'}
  }

  const [, leftOperand, operator, rightOperand] = match

  const left = Number(leftOperand)

  if (operator === undefined) {
    return Number.isFinite(left) ? {value: String(left)} : {error: 'invalid'}
  }

  const value = applyOperator(left, operator as Operator, Number(rightOperand))

  if (!Number.isFinite(value)) {
    return {error: 'invalid'}
  }

  return {value: String(value)}
}

function applyOperator(left: number, operator: Operator, right: number): number {
  switch (operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '*':
      return left * right
    case '/':
      return left / right
  }
}

export async function saveCalculation(db: Db, expression: string, value: string): Promise<void> {
  await db.insertInto('calculation').values({expression: expression.trim(), value}).execute()
}

export async function fetchCalculationHistory(db: Db): Promise<Calculation[]> {
  return await db
    .selectFrom('calculation')
    .select(['id', 'expression', 'value'])
    .orderBy('id', 'desc')
    .execute()
}

export async function deleteCalculationHistory(db: Db): Promise<void> {
  await db.deleteFrom('calculation').execute()
}
