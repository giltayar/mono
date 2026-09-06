import type {ChartConfiguration} from 'chart.js'
import {html} from '../../../commons/html-templates.ts'
import {currentLanguage, translator} from '../../../commons/i18n.ts'
import {version} from '../../../commons/version.ts'
import {categoryById} from '../categories.ts'
import type {CategoryTotal, ExpenseTypeTotal} from '../model.ts'

export function renderCategoryGraph(categoryTotals: CategoryTotal[]): string {
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
      animation: false,
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

export function renderExpenseTypeGraph(expenseTypeTotals: ExpenseTypeTotal[]): string {
  const t = translator('expenses')
  const types = expenseTypeTotals.map(({expenseType, total}, index) => ({
    name: t(`form.expenseType.${expenseType}`),
    total,
    color: CHART_COLORS[index],
  }))

  return renderPieGraph('expense-type-graph', types, t('graph.typeChartLabel'))
}

function renderPieGraph(
  id: string,
  entries: {name: string; total: number; color: string}[],
  chartLabel: string,
): string {
  const t = translator('expenses')

  if (entries.length === 0) {
    return html`<div id=${id} class="expense-graph">
      <p class="empty">${t('graph.empty')}</p>
    </div>` as string
  }

  const total = entries.reduce((sum, entry) => sum + entry.total, 0)
  const chartConfiguration: ChartConfiguration<'pie'> = {
    type: 'pie',
    data: {
      labels: entries.map(({name}) => name),
      datasets: [
        {
          data: entries.map(({total: entryTotal}) => entryTotal),
          backgroundColor: entries.map(({color}) => color),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {legend: {display: false}},
    },
  }

  return html`
    <div id=${id} class="expense-graph">
      <div class="chart-container">
        <canvas
          role="img"
          aria-label=${chartLabel}
          data-chart-configuration=${JSON.stringify(chartConfiguration)}
          data-chart-source=${`/dist/${version}/chart.js`}
          width="320"
          height="320"
        ></canvas>
      </div>
      <ul class="chart-legend">
        ${entries.map(
          ({name, total: entryTotal, color}) => html`
            <li>
              <span class="chart-swatch" style=${`--chart-color: ${color}`}></span>
              <span class="chart-category">${name}</span>
              <span class="chart-total">${formatAmount(entryTotal)}</span>
              <span class="chart-percentage">${formatPercentage(entryTotal / total)}</span>
            </li>
          `,
        )}
      </ul>
    </div>
  ` as string
}

export function renderDailyGraph(dailyTotals: number[], weekendDays: boolean[]): string {
  const t = translator('expenses')

  if (dailyTotals.every((total) => total === 0)) {
    return html`<div id="daily-expense-graph" class="expense-graph">
      <p class="empty">${t('graph.empty')}</p>
    </div>` as string
  }

  const average = dailyTotals.reduce((sum, total) => sum + total, 0) / dailyTotals.length
  const chartConfiguration: ChartConfiguration<'bar' | 'line'> = {
    type: 'bar',
    data: {
      labels: dailyTotals.map((_total, index) => String(index + 1)),
      datasets: [
        {
          type: 'bar',
          label: t('graph.dailyTotal'),
          data: dailyTotals,
          backgroundColor: weekendDays.map((isWeekend) =>
            isWeekend ? WEEKEND_DAILY_COLOR : DAILY_COLOR,
          ),
        },
        {
          type: 'line',
          label: t('graph.average'),
          data: dailyTotals.map(() => average),
          borderColor: CHART_COLORS[0],
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
    },
  }

  return html`
    <div id="daily-expense-graph" class="expense-graph">
      <div class="chart-container daily-chart-container">
        <canvas
          role="img"
          aria-label=${t('graph.dailyChartLabel')}
          data-chart-configuration=${JSON.stringify(chartConfiguration)}
          data-chart-source=${`/dist/${version}/chart.js`}
          width="640"
          height="360"
        ></canvas>
      </div>
    </div>
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

const DAILY_COLOR = CHART_COLORS[1]
const WEEKEND_DAILY_COLOR = '#66b5bd'
