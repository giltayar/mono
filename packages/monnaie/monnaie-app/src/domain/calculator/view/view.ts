import {html} from '../../../commons/html-templates.ts'
import {translator} from '../../../commons/i18n.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {Calculation, CalculationResult} from '../model.ts'

export function renderCalculatorPage(history: Calculation[]): string {
  const t = translator('calculator')

  return html`
    <${MainLayout} title=${t('page.title')} styleSheet="domain/calculator/view/style/style.css">
      <h1>${t('page.title')}</h1>
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
          aria-label=${t('form.expressionLabel')}
          placeholder=${t('form.placeholder')}
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <button type="submit">${t('form.calculate')}</button>
      </form>
      <output id="calculation-result" role="status" aria-live="polite"></output>
      ${renderCalculationHistory(history, {outOfBand: false})}
    </${MainLayout}>
  ` as string
}

export function renderCalculationResult(result: CalculationResult): string {
  const t = translator('calculator')

  return (
    'error' in result
      ? html`<span class="error">${t(`errors.${result.error}`)}</span>`
      : html`<span class="value">= ${result.value}</span>`
  ) as string
}

export function renderCalculationHistory(
  history: Calculation[],
  {outOfBand}: {outOfBand: boolean},
): string {
  const t = translator('calculator')

  return html`
    <section
      id="calculation-history"
      aria-label=${t('history.title')}
      hx-swap-oob=${outOfBand || undefined}
    >
      <h2>${t('history.title')}</h2>
      ${
        history.length === 0
          ? html`<p class="empty">${t('history.empty')}</p>`
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
                ${t('history.delete')}
              </button>
            `
      }
    </section>
  ` as string
}
