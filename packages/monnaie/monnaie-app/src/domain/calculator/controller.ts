import type {Sql} from 'postgres'
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

export async function showCalculatorPage(sql: Sql): Promise<ControllerResult> {
  return {html: renderCalculatorPage(await fetchCalculationHistory(sql))}
}

export async function calculateExpression(sql: Sql, expression: string): Promise<ControllerResult> {
  const result = calculate(expression)

  if ('error' in result) {
    return {html: renderCalculationResult(result)}
  }

  await saveCalculation(sql, expression, result.value)

  return {
    html:
      renderCalculationResult(result) +
      renderCalculationHistory(await fetchCalculationHistory(sql), {outOfBand: true}),
    headers: {'HX-Trigger': 'calculation-succeeded'},
  }
}

export async function deleteHistory(sql: Sql): Promise<ControllerResult> {
  await deleteCalculationHistory(sql)

  return {html: renderCalculationHistory([])}
}
