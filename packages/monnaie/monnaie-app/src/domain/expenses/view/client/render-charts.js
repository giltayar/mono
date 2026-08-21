/** @type {Promise<typeof import('chart.js').Chart> | undefined} */
let chartJsPromise
/** @type {WeakMap<HTMLCanvasElement, import('chart.js').Chart>} */
const charts = new WeakMap()

/** @param {string} source */
function loadChartJs(source) {
  chartJsPromise ??= import(source).then((chartModule) => chartModule.default)

  return chartJsPromise
}

/** @param {HTMLCanvasElement} canvas */
async function renderChart(canvas) {
  if (charts.has(canvas)) return

  const configuration = canvas.dataset.chartConfiguration
  const chartSource = canvas.dataset.chartSource
  if (configuration === undefined || chartSource === undefined) return

  const Chart = await loadChartJs(chartSource)

  if (!canvas.isConnected) return

  const chart = new Chart(canvas, JSON.parse(configuration))

  charts.set(canvas, chart)
}

/** @param {EventTarget | null} root */
function initializeCharts(root) {
  if (!(root instanceof Element || root instanceof Document)) return

  const canvases =
    root instanceof HTMLCanvasElement && root.matches('canvas[data-chart-configuration]')
      ? [root]
      : root.querySelectorAll('canvas[data-chart-configuration]')

  for (const canvas of canvases) {
    if (canvas instanceof HTMLCanvasElement) void renderChart(canvas)
  }
}

/** @param {EventTarget | null} root */
function destroyCharts(root) {
  if (!(root instanceof Element)) return

  const canvases =
    root instanceof HTMLCanvasElement && root.matches('canvas[data-chart-configuration]')
      ? [root]
      : root.querySelectorAll('canvas[data-chart-configuration]')

  for (const canvas of canvases) {
    if (canvas instanceof HTMLCanvasElement) {
      charts.get(canvas)?.destroy()
      charts.delete(canvas)
    }
  }
}

initializeCharts(document)
document.addEventListener('htmx:afterSwap', (event) => initializeCharts(event.target))
document.addEventListener('htmx:beforeCleanupElement', (event) => destroyCharts(event.target))
