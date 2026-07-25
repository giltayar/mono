import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {CalculationResult} from '../model.ts'

export function renderCalculatorPage(): string {
  return html`
    <${MainLayout} title="Monnaie" styleSheet="domain/calculator/view/style/style.css">
      <h1>Monnaie</h1>
      <form
        id="calculation-form"
        hx-post="/calculate"
        hx-target="#calculation-result"
        hx-swap="innerHTML"
      >
        <input
          type="text"
          name="expression"
          aria-label="Calculation"
          placeholder="12 + 30"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <button type="submit">Calculate</button>
      </form>
      <output id="calculation-result" role="status" aria-live="polite"></output>
    </${MainLayout}>
  ` as string
}

export function renderCalculationResult(result: CalculationResult): string {
  return (
    'error' in result
      ? html`<span class="error">${result.error}</span>`
      : html`<span class="value">= ${result.value}</span>`
  ) as string
}
