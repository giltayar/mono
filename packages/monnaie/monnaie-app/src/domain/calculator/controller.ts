import type {Db} from '../../commons/db.ts'
import type {ControllerResult} from '../../commons/controller.ts'
import {currentUserOrFail} from '../../commons/auth.ts'
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

export async function showCalculatorPage(db: Db): Promise<ControllerResult> {
  const {uid} = currentUserOrFail()

  return {html: renderCalculatorPage(await fetchCalculationHistory(db, uid))}
}

export async function calculateExpression(db: Db, expression: string): Promise<ControllerResult> {
  const {uid} = currentUserOrFail()
  const result = calculate(expression)

  if ('error' in result) {
    return {html: renderCalculationResult(result)}
  }

  await saveCalculation(db, uid, expression, result.value)

  return {
    html:
      renderCalculationResult(result) +
      renderCalculationHistory(await fetchCalculationHistory(db, uid), {outOfBand: true}),
    headers: {'HX-Trigger': 'calculation-succeeded'},
  }
}

export async function deleteHistory(db: Db): Promise<ControllerResult> {
  const {uid} = currentUserOrFail()

  await deleteCalculationHistory(db, uid)

  return {html: renderCalculationHistory([])}
}
