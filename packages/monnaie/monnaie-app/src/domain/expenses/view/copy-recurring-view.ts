import {html} from '../../../commons/html-templates.ts'
import {currentLanguage, translator} from '../../../commons/i18n.ts'
import {categoryById} from '../categories.ts'
import type {Expense} from '../model.ts'

export function renderCopyRecurringDialog(expenses: Expense[], date: string): string {
  const t = translator('expenses')

  return html`
    <dialog id="copy-recurring-dialog" aria-labelledby="copy-recurring-title">
      <form hx-post="/expenses/copy-recurring" hx-target="#copy-recurring-dialog-container">
        <h2 id="copy-recurring-title">${t('copyRecurring.title')}</h2>
        ${
          expenses.length === 0
            ? html`<p class="empty">${t('copyRecurring.empty')}</p>`
            : html`
                <label class="copy-recurring-select-all">
                  <input
                    type="checkbox"
                    onclick="
                      const checked = this.checked;
                      this.form.querySelectorAll('input[name=expenseId]').forEach(
                        (input) => input.checked = checked
                      )
                    "
                  />
                  <span>${t('copyRecurring.selectAll')}</span>
                </label>
                <fieldset class="copy-recurring-options">
                  <legend>${t('copyRecurring.expenses')}</legend>
                  ${expenses.map(
                    (expense) => html`
                      <label>
                        <input type="checkbox" name="expenseId" value=${expense.id} />
                        <span class="copy-recurring-description">${expense.description}</span>
                        <span class="copy-recurring-meta">
                          ${categoryById(expense.categoryId)?.name} ·
                          ${formatAmount(expense.amount)}
                        </span>
                      </label>
                    `,
                  )}
                </fieldset>
              `
        }
        <label for="copy-recurring-date">${t('copyRecurring.date')}</label>
        <input id="copy-recurring-date" type="date" name="date" value=${date} required />
        <div class="copy-recurring-actions">
          <button type="submit">${t('copyRecurring.copy')}</button>
          <button
            type="button"
            onclick="
              const dialog = this.closest('dialog');
              dialog.close();
              dialog.remove()
            "
          >
            ${t('copyRecurring.cancel')}
          </button>
        </div>
      </form>
    </dialog>
  ` as string
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat(currentLanguage(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
