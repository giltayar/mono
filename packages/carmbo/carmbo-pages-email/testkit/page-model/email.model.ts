import type {Page} from '@playwright/test'

export function createEmailListPageModel(page: Page) {
  const table = page.getByRole('table')
  const rows = table.locator('tbody tr').filter({has: page.locator('a[href^="/emails/"]')})
  return {
    search: () => ({locator: page.getByRole('searchbox')}),
    table: () => ({locator: table}),
    rows: () => ({
      locator: rows,
      row: (index: number) => ({
        locator: rows.nth(index),
        number: () => ({locator: rows.nth(index).getByRole('link').first()}),
        cell: (indexOfCell: number) => ({
          locator: rows.nth(index).getByRole('cell').nth(indexOfCell),
        }),
      }),
    }),
    empty: () => ({locator: table.getByRole('cell', {name: /No emails found|לא נמצאו אימיילים/})}),
  }
}

export function createEmailPageModel(page: Page) {
  const details = page.getByRole('region', {name: /Email details|פרטי אימייל/})
  return {
    heading: () => ({locator: page.getByRole('heading', {level: 2})}),
    details: () => ({
      locator: details,
      field: (name: string) => {
        const locator = details
          .locator('div')
          .filter({has: page.getByText(name, {exact: true})})
          .locator('dd')
        return {
          locator,
          link: () => ({locator: locator.getByRole('link')}),
          timestamps: () => ({locator: locator.locator('time')}),
        }
      },
    }),
    preview: () => ({
      locator: page.locator('iframe'),
      body: () => ({locator: page.frameLocator('iframe').locator('body')}),
    }),
    plainText: () => ({locator: page.getByRole('region', {name: /Plain text|טקסט פשוט/})}),
    rawHtml: () => ({locator: page.getByRole('link', {name: /Show raw HTML|הצגת HTML גולמי/})}),
    back: () => ({locator: page.getByRole('link', {name: /Back to emails|חזרה לאימיילים/})}),
  }
}
