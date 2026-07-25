export type CalculationResult = {value: string} | {error: string}

export function calculate(expression: string): CalculationResult {
  if (expression.trim() === '') {
    return {error: 'Please enter a calculation'}
  }

  try {
    // Temporary: `eval` is used only until we have a real expense calculator
    const value = eval(expression)

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return {error: 'Not a valid calculation'}
    }

    return {value: String(value)}
  } catch {
    return {error: 'Not a valid calculation'}
  }
}
