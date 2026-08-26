import {html} from '../../../commons/html-templates.ts'
import type {ChartConfiguration} from 'chart.js'
import {currentLanguage, translator} from '../../../commons/i18n.ts'
import {version} from '../../../commons/version.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {categoryById, EXPENSE_CATEGORIES} from '../categories.ts'
import type {CategoryTotal, Expense, PeriodTotals} from '../model.ts'
import {
  BASE_PERIOD_NAMES,
  previousPeriodName,
  type BasePeriodName,
  type PeriodDayCounts,
} from '../periods.ts'

const STYLE_SHEET = 'domain/expenses/view/style/style.css'
const SCRIPT = 'domain/expenses/view/client/render-charts.js'
const CHART_COLORS = [
  '#d1495b',
  '#00798c',
  '#edae49',
  '#30638e',
  '#6a994e',
  '#9c6644',
  '#7251b5',
  '#e76f51',
  '#2a9d8f',
  '#577590',
  '#f4a261',
  '#bc4749',
  '#4d908e',
  '#f9844a',
  '#7f4f24',
  '#277da1',
]

export function renderExpensesPage(
  totals: PeriodTotals,
  dayCounts: PeriodDayCounts,
  expenses: Expense[],
  timeZone: string,
  categoryIds: number[],
): string {
  const t = translator('expenses')

  return html`
    <${MainLayout}
      title=${t('page.title')}
      heading=${t('page.title')}
      styleSheet=${STYLE_SHEET}
      script=${SCRIPT}
    >
      ${renderCategoryFilter('/', categoryIds)}
      <div id="expense-content">
        ${renderExpenseSummary(totals, dayCounts, {outOfBand: false})}
        <a class="add-expense" href="/expenses/new">${t('actions.add')}</a>
        ${renderExpensesMonth(expenses, timeZone, categoryIds)}
      </div>
    </${MainLayout}>
  ` as string
}

export function renderGraphsPage(
  totals: PeriodTotals,
  dayCounts: PeriodDayCounts,
  categoryTotals: CategoryTotal[],
  categoryIds: number[],
): string {
  const t = translator('expenses')

  return html`
    <${MainLayout}
      title=${t('page.title')}
      heading=${t('page.title')}
      styleSheet=${STYLE_SHEET}
      script=${SCRIPT}
    >
      ${renderCategoryFilter('/expenses/graphs', categoryIds)}
      <div id="expense-content">
        ${renderExpenseSummary(totals, dayCounts, {outOfBand: false})}
        <a class="add-expense" href="/expenses/new">${t('actions.add')}</a>
        ${renderGraphsMonth(categoryTotals, categoryIds)}
      </div>
    </${MainLayout}>
  ` as string
}

/**
 * Deliberately outside `#expense-content`, which is what it swaps: nothing ever re-renders it, so
 * which pills are ticked and whether the disclosure is open stay the browser's between requests.
 * The price is that `hx-get` is frozen at the tab this page loaded on, so the path is taken from
 * the address bar at request time instead — the tabs push it, and the filter follows.
 */
function renderCategoryFilter(path: string, categoryIds: number[]): string {
  const t = translator('expenses')

  return html`
    <form
      id="category-filter"
      method="get"
      action=${path}
      hx-get=${path}
      hx-on:htmx:config-request="event.detail.path = location.pathname"
      hx-trigger="change"
      hx-target="#expense-content"
      hx-select="#expense-content"
      hx-swap="outerHTML"
      hx-push-url="true"
    >
      <details open=${categoryIds.length > 0 || undefined}>
        <summary>${t('filter.label')}</summary>
        <fieldset class="category-options" aria-label=${t('filter.categories')}>
          ${EXPENSE_CATEGORIES.map(
            (category) => html`
              <label>
                <input
                  type="checkbox"
                  name="category"
                  value=${category.id}
                  checked=${categoryIds.includes(category.id) || undefined}
                />
                <span>${category.name}</span>
              </label>
            `,
          )}
        </fieldset>
        <noscript><button type="submit">${t('filter.apply')}</button></noscript>
      </details>
    </form>
  ` as string
}

/** The ids, never the names: an id is permanent, so a bookmarked filter keeps its meaning */
function categoryFilterQuery(categoryIds: number[]): string {
  if (categoryIds.length === 0) {
    return ''
  }

  return `?${new URLSearchParams(categoryIds.map((id) => ['category', String(id)]))}`
}

export function renderExpensesMonth(
  expenses: Expense[],
  timeZone: string,
  categoryIds: number[],
): string {
  return renderMonthlyPanel(
    'expenses',
    renderExpenseList(expenses, {outOfBand: false, timeZone, categoryIds}),
    categoryIds,
  )
}

export function renderGraphsMonth(categoryTotals: CategoryTotal[], categoryIds: number[]): string {
  return renderMonthlyPanel('graphs', renderCategoryGraph(categoryTotals), categoryIds)
}

function renderMonthlyPanel(
  activeTab: 'expenses' | 'graphs',
  content: string,
  categoryIds: number[],
): string {
  const t = translator('expenses')
  const filter = categoryFilterQuery(categoryIds)

  return html`
    <section id="expense-month" aria-label=${t('list.title')}>
      <div class="month-header">
        <h2>${t('list.title')}</h2>
        <nav aria-label=${t('tabs.label')}>
          ${renderTab(t('tabs.expenses'), `/${filter}`, activeTab === 'expenses')}
          ${renderTab(t('tabs.graphs'), `/expenses/graphs${filter}`, activeTab === 'graphs')}
        </nav>
      </div>
      ${content}
    </section>
  ` as string
}

function renderTab(label: string, href: string, active: boolean): string {
  return html`
    <a
      href=${href}
      aria-current=${active ? 'page' : undefined}
      hx-get=${href}
      hx-target="#expense-month"
      hx-select="#expense-month"
      hx-swap="outerHTML"
      hx-push-url="true"
    >
      ${label}
    </a>
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
  {outOfBand, timeZone, categoryIds}: {outOfBand: boolean; timeZone: string; categoryIds: number[]},
): string {
  const t = translator('expenses')

  return html`
    <div id="expense-list" hx-swap-oob=${outOfBand || undefined}>
      ${
        expenses.length === 0
          ? html`<p class="empty">${t('list.empty')}</p>`
          : html`
              <ul>
                ${expenses.map((expense) => renderExpenseItem(expense, timeZone, categoryIds))}
              </ul>
            `
      }
    </div>
  ` as string
}

function renderCategoryGraph(categoryTotals: CategoryTotal[]): string {
  const t = translator('expenses')
  const categories = categoryTotals.flatMap(({categoryId, total}, index) => {
    const category = categoryById(categoryId)

    return category === undefined
      ? []
      : [{name: category.name, total, color: CHART_COLORS[index % CHART_COLORS.length]}]
  })

  if (categories.length === 0) {
    return html`<div id="expense-graph"><p class="empty">${t('graph.empty')}</p></div>` as string
  }

  const total = categories.reduce((sum, category) => sum + category.total, 0)
  const chartConfiguration: ChartConfiguration<'pie'> = {
    type: 'pie',
    data: {
      labels: categories.map(({name}) => name),
      datasets: [
        {
          data: categories.map(({total: categoryTotal}) => categoryTotal),
          backgroundColor: categories.map(({color}) => color),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {legend: {display: false}},
    },
  }

  return html`
    <div id="expense-graph">
      <div class="chart-container">
        <canvas
          role="img"
          aria-label=${t('graph.chartLabel')}
          data-chart-configuration=${JSON.stringify(chartConfiguration)}
          data-chart-source=${`/dist/${version}/chart.js`}
          width="320"
          height="320"
        ></canvas>
      </div>
      <ul class="chart-legend">
        ${categories.map(
          ({name, total: categoryTotal, color}) => html`
            <li>
              <span class="chart-swatch" style=${`--chart-color: ${color}`}></span>
              <span class="chart-category">${name}</span>
              <span class="chart-total">${formatAmount(categoryTotal)}</span>
              <span class="chart-percentage">${formatPercentage(categoryTotal / total)}</span>
            </li>
          `,
        )}
      </ul>
    </div>
  ` as string
}

function renderExpenseItem(expense: Expense, timeZone: string, categoryIds: number[]): string {
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
          hx-delete=${`/expenses/${expense.id}${categoryFilterQuery(categoryIds)}`}
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

function formatPercentage(value: number): string {
  return new Intl.NumberFormat(currentLanguage(), {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
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
