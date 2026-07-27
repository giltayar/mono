import type {Db} from '../../commons/db.ts'
import type {ControllerResult} from '../../commons/controller.ts'
import {
  calculate,
  deleteCalculationHistory,
  fetchCalculationHistory,
  saveCalculation,
} from './model.ts'
import {
  renderCalculationHistory,
  renderCalculationResult,
  renderCalculatorPage,
} from './view/view.ts'

export async function showCalculatorPage(db: Db, userId: string): Promise<ControllerResult> {
  return {html: renderCalculatorPage(await fetchCalculationHistory(db, userId))}
}

export async function calculateExpression(
  db: Db,
  userId: string,
  expression: string,
): Promise<ControllerResult> {
  const result = calculate(expression)

  if ('error' in result) {
    return {html: renderCalculationResult(result)}
  }

  await saveCalculation(db, userId, expression, result.value)

  return {
    html:
      renderCalculationResult(result) +
      renderCalculationHistory(await fetchCalculationHistory(db, userId), {outOfBand: true}),
    headers: {'HX-Trigger': 'calculation-succeeded'},
  }
}

export async function deleteHistory(db: Db, userId: string): Promise<ControllerResult> {
  await deleteCalculationHistory(db, userId)

  return {html: renderCalculationHistory([])}
}
