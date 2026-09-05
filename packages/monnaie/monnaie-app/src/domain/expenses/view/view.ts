import {html} from '../../../commons/html-templates.ts'
import type {ChartConfiguration} from 'chart.js'
import {currentLanguage, translator} from '../../../commons/i18n.ts'
import {version} from '../../../commons/version.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {categoryById, EXPENSE_CATEGORIES} from '../categories.ts'
import {
  type CategoryTotal,
  type Expense,
  type ExpenseType,
  type ExpenseTypeFilter,
  type PeriodTotals,
} from '../model.ts'
import {
  BASE_PERIOD_NAMES,
  previousPeriodName,
  type BasePeriodName,
  type PeriodDayCounts,
  type PeriodNavigationDates,
} from '../periods.ts'

const STYLE_SHEET = 'domain/expenses/view/style/style.css'
const SCRIPT = 'domain/expenses/view/client/render-charts.js'
const RESET_TO_TODAY_ON_CLICK = `
  const query = new URL(location.href).searchParams;
  query.delete('day');
  event.currentTarget.href = '/' + (query.size === 0 ? '' : '?' + query)
`
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
  expenseTypes: ExpenseTypeFilter,
  query: string,
  referenceDate: Date,
  selectedDay: string | undefined,
  currentDay: string,
  navigationDates: PeriodNavigationDates,
): string {
  const t = translator('expenses')

  return html`
    <${MainLayout}
      title=${t('page.title')}
      heading=${t('page.title')}
      headingHref=${`/${expenseQueryForDay(query, undefined)}`}
      headingOnClick=${RESET_TO_TODAY_ON_CLICK}
      styleSheet=${STYLE_SHEET}
      script=${SCRIPT}
    >
      ${renderCategoryFilter('/', categoryIds, expenseTypes, selectedDay)}
      <div id="expense-content">
        ${renderExpenseSummary(totals, dayCounts, {
          outOfBand: false,
          path: '/',
          referenceDate,
          referenceDay: selectedDay ?? currentDay,
          currentDay,
          timeZone,
          query,
          navigationDates,
        })}
        ${renderCreateExpenseActions(query)}
        ${renderExpensesMonth(expenses, timeZone, query)}
      </div>
    </${MainLayout}>
  ` as string
}

export function renderGraphsPage(
  totals: PeriodTotals,
  dayCounts: PeriodDayCounts,
  categoryTotals: CategoryTotal[],
  categoryIds: number[],
  expenseTypes: ExpenseTypeFilter,
  query: string,
  referenceDate: Date,
  timeZone: string,
  selectedDay: string | undefined,
  currentDay: string,
  navigationDates: PeriodNavigationDates,
): string {
  const t = translator('expenses')

  return html`
    <${MainLayout}
      title=${t('page.title')}
      heading=${t('page.title')}
      headingHref=${`/${expenseQueryForDay(query, undefined)}`}
      headingOnClick=${RESET_TO_TODAY_ON_CLICK}
      styleSheet=${STYLE_SHEET}
      script=${SCRIPT}
    >
      ${renderCategoryFilter('/expenses/graphs', categoryIds, expenseTypes, selectedDay)}
      <div id="expense-content">
        ${renderExpenseSummary(totals, dayCounts, {
          outOfBand: false,
          path: '/expenses/graphs',
          referenceDate,
          referenceDay: selectedDay ?? currentDay,
          currentDay,
          timeZone,
          query,
          navigationDates,
        })}
        ${renderCreateExpenseActions(query)}
        ${renderGraphsMonth(categoryTotals, query)}
      </div>
    </${MainLayout}>
  ` as string
}

function renderCreateExpenseActions(query: string): string {
  const t = translator('expenses')

  return html`
    <div class="expense-create-actions">
      <a class="add-expense" href=${`/expenses/new${query}`}>${t('actions.add')}</a>
      <button
        class="copy-recurring"
        type="button"
        hx-get="/expenses/copy-recurring"
        hx-target="#copy-recurring-dialog-container"
      >
        ${t('actions.copyRecurring')}
      </button>
    </div>
    <div
      id="copy-recurring-dialog-container"
      hx-on:htmx:after-swap="this.querySelector('dialog')?.showModal()"
    ></div>
  ` as string
}

/**
 * Deliberately outside `#expense-content`, which is what it swaps: nothing ever re-renders it, so
 * which pills are ticked and whether the disclosure is open stay the browser's between requests.
 * The price is that `hx-get` is frozen at the tab this page loaded on, so the path is taken from
 * the address bar at request time instead — the tabs push it, and the filter follows.
 */
function renderCategoryFilter(
  path: string,
  categoryIds: number[],
  expenseTypes: ExpenseTypeFilter,
  selectedDay: string | undefined,
): string {
  const t = translator('expenses')

  return html`
    <form
      id="category-filter"
      method="get"
      action=${path}
      hx-get=${path}
      hx-on:htmx:config-request="
        const day = new URL(location.href).searchParams.get('day');
        if (day === null) delete event.detail.parameters.day;
        else event.detail.parameters.day = day;
        const selectedTypes = Array.from(this.querySelectorAll('[name=expenseType]:checked'), input => input.value);
        if (selectedTypes.length === 2 && selectedTypes.includes('day-to-day') && selectedTypes.includes('special')) {
          delete event.detail.parameters.expenseType;
        }
        event.detail.path = location.pathname
      "
      hx-trigger="change"
      hx-target="#expense-content"
      hx-select="#expense-content"
      hx-swap="outerHTML"
      hx-push-url="true"
    >
      <input
        type="hidden"
        name="day"
        value=${selectedDay}
        disabled=${selectedDay === undefined || undefined}
      />
      <div class="filter-controls">
        <button
          class="category-filter-toggle"
          type="button"
          aria-controls="category-options"
          aria-expanded=${categoryIds.length > 0 ? 'true' : 'false'}
          onclick="
            const categories = document.getElementById('category-options');
            categories.hidden = !categories.hidden;
            this.setAttribute('aria-expanded', String(!categories.hidden))
          "
        >
          ${t('filter.label')}
        </button>
        <fieldset class="expense-type-filter" aria-label=${t('filter.expenseType')}>
          ${(['day-to-day', 'special', 'recurring'] as const).map((expenseType) =>
            renderExpenseTypeFilterOption(expenseType, expenseTypes.includes(expenseType)),
          )}
        </fieldset>
      </div>
      <fieldset
        id="category-options"
        class="category-options"
        aria-label=${t('filter.categories')}
        hidden=${categoryIds.length === 0 || undefined}
      >
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
    </form>
  ` as string
}

function renderExpenseTypeFilterOption(expenseType: ExpenseType, checked: boolean): string {
  const t = translator('expenses')

  return html`
    <label
      ondblclick="
        event.preventDefault();
        const selected = this.querySelector('input');
        for (const input of this.form.elements.expenseType) input.checked = input === selected;
        selected.dispatchEvent(new Event('change', {bubbles: true}))
      "
      onpointerdown="
        if (event.pointerType !== 'mouse') {
          this.dataset.longPress = 'false';
          this.longPressTimer = setTimeout(() => {
            this.dataset.longPress = 'true';
            const selected = this.querySelector('input');
            for (const input of this.form.elements.expenseType) input.checked = input === selected;
            selected.dispatchEvent(new Event('change', {bubbles: true}))
          }, 500)
        }
      "
      onpointerup="
        clearTimeout(this.longPressTimer);
        if (this.dataset.longPress === 'true') {
          setTimeout(() => { this.dataset.longPress = 'false' })
        }
      "
      onpointercancel="clearTimeout(this.longPressTimer)"
      onclick="
        if (this.dataset.longPress === 'true') {
          event.preventDefault();
          this.dataset.longPress = 'false'
        }
      "
    >
      <input
        type="checkbox"
        name="expenseType"
        value=${expenseType}
        checked=${checked || undefined}
        onchange="
          if (!this.form.querySelector('[name=expenseType]:checked')) this.checked = true;
          event.stopPropagation();
          clearTimeout(this.form.expenseTypeFilterTimer);
          this.form.expenseTypeFilterTimer = setTimeout(() => {
            this.form.dispatchEvent(new Event('change'))
          }, 300)
        "
      />
      <span>${t(`form.expenseType.${expenseType}`)}</span>
    </label>
  ` as string
}

function expenseQueryForDay(query: string, selectedDay: string | undefined): string {
  const queryParameters = new URLSearchParams(query)

  if (selectedDay === undefined) {
    queryParameters.delete('day')
  } else {
    queryParameters.set('day', selectedDay)
  }

  return queryParameters.size === 0 ? '' : `?${queryParameters}`
}

export function renderExpensesMonth(expenses: Expense[], timeZone: string, query: string): string {
  return renderMonthlyPanel(
    'expenses',
    renderExpenseList(expenses, {
      outOfBand: false,
      timeZone,
      query,
    }),
    query,
  )
}

export function renderGraphsMonth(categoryTotals: CategoryTotal[], query: string): string {
  return renderMonthlyPanel('graphs', renderCategoryGraph(categoryTotals), query)
}

function renderMonthlyPanel(
  activeTab: 'expenses' | 'graphs',
  content: string,
  query: string,
): string {
  const t = translator('expenses')

  return html`
    <section id="expense-month" aria-label=${t('list.title')}>
      <div class="month-header">
        <h2>${t('list.title')}</h2>
        <nav aria-label=${t('tabs.label')}>
          ${renderTab(t('tabs.expenses'), `/${query}`, activeTab === 'expenses')}
          ${renderTab(t('tabs.graphs'), `/expenses/graphs${query}`, activeTab === 'graphs')}
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
  {
    outOfBand,
    path,
    referenceDate,
    referenceDay,
    currentDay,
    timeZone,
    query,
    navigationDates,
  }: {
    outOfBand: boolean
    path: string
    referenceDate: Date
    referenceDay: string
    currentDay: string
    timeZone: string
    query: string
    navigationDates: PeriodNavigationDates
  },
): string {
  const t = translator('expenses')
  const discussionDay =
    referenceDay === currentDay ? t('summary.today') : formatDiscussionDate(referenceDate, timeZone)

  return html`
    <section
      id="expense-summary"
      aria-label=${t('summary.title')}
      hx-swap-oob=${outOfBand || undefined}
    >
      <h2>
        <a
          href=${`${path}${expenseQueryForDay(query, undefined)}`}
          hx-get=${`${path}${expenseQueryForDay(query, undefined)}`}
          hx-on:htmx:config-request="event.detail.path = location.pathname + new URL(event.detail.path, location.href).search"
          hx-target="#expense-content"
          hx-select="#expense-content"
          hx-swap="outerHTML"
          hx-push-url="true"
        >
          ${`${t('summary.title')}: ${discussionDay}`}
        </a>
      </h2>
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
                <th scope="row">
                  <span class="period-heading">
                    <span>${t(`summary.${period}`)}</span>
                    <span class="period-navigation">
                      ${renderPeriodNavigation(
                        path,
                        query,
                        navigationDates[period],
                        t(`summary.${period}`),
                        currentDay,
                      )}
                    </span>
                  </span>
                </th>
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

function renderPeriodNavigation(
  path: string,
  query: string,
  dates: {backward: string; forward: string | undefined},
  periodLabel: string,
  currentDay: string,
): string {
  const t = translator('expenses')
  const backwardQuery = expenseQueryForDay(query, dates.backward)
  const forwardQuery =
    dates.forward === undefined
      ? undefined
      : expenseQueryForDay(query, dates.forward === currentDay ? undefined : dates.forward)

  return html`
    <a
      href=${`${path}${backwardQuery}`}
      hx-get=${`${path}${backwardQuery}`}
      hx-on:htmx:config-request="event.detail.path = location.pathname + new URL(event.detail.path, location.href).search"
      hx-target="#expense-content"
      hx-select="#expense-content"
      hx-swap="outerHTML"
      hx-push-url="true"
      aria-label=${t('summary.backward', {period: periodLabel})}
      >←</a
    >
    ${
      forwardQuery === undefined
        ? html`<span aria-hidden="true">→</span>`
        : html`<a
            href=${`${path}${forwardQuery}`}
            hx-get=${`${path}${forwardQuery}`}
            hx-on:htmx:config-request="event.detail.path = location.pathname + new URL(event.detail.path, location.href).search"
            hx-target="#expense-content"
            hx-select="#expense-content"
            hx-swap="outerHTML"
            hx-push-url="true"
            aria-label=${t('summary.forward', {period: periodLabel})}
            >→</a
          >`
    }
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
  {
    outOfBand,
    timeZone,
    query,
  }: {
    outOfBand: boolean
    timeZone: string
    query: string
  },
): string {
  const t = translator('expenses')

  return html`
    <div id="expense-list" hx-swap-oob=${outOfBand || undefined}>
      ${
        expenses.length === 0
          ? html`<p class="empty">${t('list.empty')}</p>`
          : html`
              <ul>
                ${expenses.map((expense) => renderExpenseItem(expense, timeZone, query))}
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

function renderExpenseItem(expense: Expense, timeZone: string, query: string): string {
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
          href=${`/expenses/${expense.id}/edit${query}`}
          aria-label=${`${t('actions.edit')} ${expense.description}`}
        >
          ${t('actions.edit')}
        </a>
        <button
          type="button"
          aria-label=${`${t('actions.delete')} ${expense.description}`}
          hx-delete=${`/expenses/${expense.id}${query}`}
          hx-target="#expense-list"
          hx-swap="outerHTML"
          hx-confirm=${t('actions.confirmDelete')}
        >
          ${t('actions.delete')}
        </button>
        ${
          expense.expenseType === 'recurring'
            ? html`<span class="expense-type expense-recurring">${t('list.recurring')}</span>`
            : expense.expenseType === 'special'
              ? html`<span class="expense-type expense-special">${t('list.special')}</span>`
              : undefined
        }
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

function formatDiscussionDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(currentLanguage(), {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}
