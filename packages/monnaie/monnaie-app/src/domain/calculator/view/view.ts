import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {Calculation, CalculationResult} from '../model.ts'

export function renderCalculatorPage(history: Calculation[]): string {
  return html`
    <${MainLayout} title="Monnaie" styleSheet="domain/calculator/view/style/style.css">
      <h1>Monnaie</h1>
      <form
        id="calculation-form"
        hx-post="/calculate"
        hx-target="#calculation-result"
        hx-swap="innerHTML"
        hx-on:calculation-succeeded="this.reset()"
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
      ${renderCalculationHistory(history)}
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

export function renderCalculationHistory(
  history: Calculation[],
  {outOfBand = false}: {outOfBand?: boolean} = {},
): string {
  return html`
    <section id="calculation-history" aria-label="History" hx-swap-oob=${outOfBand || undefined}>
      <h2>History</h2>
      ${
        history.length === 0
          ? html`<p class="empty">No calculations yet</p>`
          : html`
              <ul>
                ${history.map(
                  (calculation) => html`
                    <li>
                      <span class="expression">${calculation.expression}</span>
                      <span class="value">= ${calculation.value}</span>
                    </li>
                  `,
                )}
              </ul>
              <button
                type="button"
                hx-delete="/history"
                hx-target="#calculation-history"
                hx-swap="outerHTML"
              >
                Delete history
              </button>
            `
      }
    </section>
  ` as string
}
