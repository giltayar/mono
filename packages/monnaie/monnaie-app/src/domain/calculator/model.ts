export type CalculationResult = {value: string} | {error: string}

type Operator = '+' | '-' | '*' | '/'

const CALCULATION_REGEX = /^\s*(-?\d+(?:\.\d+)?)\s*(?:([-+*/])\s*(-?\d+(?:\.\d+)?)\s*)?$/

export function calculate(expression: string): CalculationResult {
  if (expression.trim() === '') {
    return {error: 'Please enter a calculation'}
  }

  const match = CALCULATION_REGEX.exec(expression)

  if (match === null) {
    return {error: 'Not a valid calculation'}
  }

  const [, leftOperand, operator, rightOperand] = match

  const left = Number(leftOperand)

  if (operator === undefined) {
    return Number.isFinite(left) ? {value: String(left)} : {error: 'Not a valid calculation'}
  }

  const value = applyOperator(left, operator as Operator, Number(rightOperand))

  if (!Number.isFinite(value)) {
    return {error: 'Not a valid calculation'}
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
