import {html} from '../../../commons/html-templates.ts'
import {currentLanguage, translator} from '../../../commons/i18n.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {categoryById} from '../categories.ts'
import type {Expense, PeriodTotals} from '../model.ts'
import {
  BASE_PERIOD_NAMES,
  previousPeriodName,
  type BasePeriodName,
  type PeriodDayCounts,
} from '../periods.ts'

const STYLE_SHEET = 'domain/expenses/view/style/style.css'

export function renderExpensesPage(
  totals: PeriodTotals,
  dayCounts: PeriodDayCounts,
  expenses: Expense[],
  timeZone: string,
): string {
  const t = translator('expenses')

  return html`
    <${MainLayout} title=${t('page.title')} heading=${t('page.title')} styleSheet=${STYLE_SHEET}>
      ${renderExpenseSummary(totals, dayCounts, {outOfBand: false})}
      <a class="add-expense" href="/expenses/new">${t('actions.add')}</a>
      ${renderExpenseList(expenses, {outOfBand: false, timeZone})}
    </${MainLayout}>
  ` as string
}

export function renderExpenseSummary(
  totals: PeriodTotals,
  dayCounts: PeriodDayCounts,
  {outOfBand}: {outOfBand: boolean},
): string {
  const t = translator('expenses')

  return html`
    <section
      id="expense-summary"
      aria-label=${t('summary.title')}
      hx-swap-oob=${outOfBand || undefined}
    >
      <h2>${t('summary.title')}</h2>
      <table>
        <thead>
          <tr>
            <td></td>
            <th scope="col">${t('summary.current')}</th>
            <th scope="col">${t('summary.previous')}</th>
          </tr>
        </thead>
        <tbody>
          ${BASE_PERIOD_NAMES.map(
            (period) => html`
              <tr>
                <th scope="row">${t(`summary.${period}`)}</th>
                <td>${renderPeriodTotal(period, totals[period], dayCounts[period])}</td>
                <td class="previous">
                  ${renderPeriodTotal(
                    period,
                    totals[previousPeriodName(period)],
                    dayCounts[previousPeriodName(period)],
                  )}
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </section>
  ` as string
}

function renderPeriodTotal(period: BasePeriodName, total: number, dayCount: number): string {
  const t = translator('expenses')

  return html`
    <span class="total">${formatAmount(total)}</span>
    ${
      period === 'day'
        ? undefined
        : html`<small class="daily-average"
            >${formatAmount(total / dayCount)} ${t('summary.perDay')}</small
          >`
    }
  ` as string
}

export function renderExpenseList(
  expenses: Expense[],
  {outOfBand, timeZone}: {outOfBand: boolean; timeZone: string},
): string {
  const t = translator('expenses')

  return html`
    <section id="expense-list" aria-label=${t('list.title')} hx-swap-oob=${outOfBand || undefined}>
      <h2>${t('list.title')}</h2>
      ${
        expenses.length === 0
          ? html`<p class="empty">${t('list.empty')}</p>`
          : html`
              <ul>
                ${expenses.map((expense) => renderExpenseItem(expense, timeZone))}
              </ul>
            `
      }
    </section>
  ` as string
}

function renderExpenseItem(expense: Expense, timeZone: string): string {
  const t = translator('expenses')

  return html`
    <li>
      <div class="expense-what">
        <span class="expense-description">${expense.description}</span>
      </div>
      <span class="expense-amount">${formatAmount(expense.amount)}</span>
      <div class="expense-meta">
        <span class="expense-category">${categoryById(expense.categoryId)?.name}</span>
        <time class="expense-date" datetime=${expense.createdAt.toISOString()}>
          ${formatDate(expense.createdAt, timeZone)}
        </time>
      </div>
      <div class="expense-actions">
        <a
          href=${`/expenses/${expense.id}/edit`}
          aria-label=${`${t('actions.edit')} ${expense.description}`}
        >
          ${t('actions.edit')}
        </a>
        <button
          type="button"
          aria-label=${`${t('actions.delete')} ${expense.description}`}
          hx-delete=${`/expenses/${expense.id}`}
          hx-target="#expense-list"
          hx-swap="outerHTML"
          hx-confirm=${t('actions.confirmDelete')}
        >
          ${t('actions.delete')}
        </button>
      </div>
    </li>
  ` as string
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat(currentLanguage(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(date: Date, timeZone: string): string {
  // the same timezone the periods are calculated in, so that an expense never looks as if it
  // belongs to a different day than the one it was counted in
  return new Intl.DateTimeFormat(currentLanguage(), {
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(date)
}
