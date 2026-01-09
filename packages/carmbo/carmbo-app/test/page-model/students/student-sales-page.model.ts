import type {Page} from '@playwright/test'
import {createAllPagesPageModel} from '../common/all-pages.model.ts'

export function createStudentSalesPageModel(page: Page) {
  const tabsNav = page.locator('.nav-tabs')
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/students\/\d+\/sales$/,
    pageTitle: (locator = page.getByRole('heading', {name: /Student \d+ Sales/})) => ({locator}),
    tabs: () => ({
      detailsTab: (locator = tabsNav.getByRole('link', {name: 'Details'})) => ({locator}),
      salesTab: (locator = tabsNav.getByRole('link', {name: 'Sales'})) => ({locator}),
    }),
    salesTable: (tableLocator = page.getByRole('table')) => ({
      locator: tableLocator,
      rows: (rowsLocator = tableLocator.getByRole('row')) => ({
        locator: rowsLocator,
      }),
      saleButton: (saleNumber: number) => ({
        locator: tableLocator.getByRole('button', {name: String(saleNumber), exact: true}),
      }),
      salesEventLink: (salesEventName: string) => ({
        locator: tableLocator.getByRole('link', {name: salesEventName}),
      }),
      productLink: (productName: string) => ({
        locator: tableLocator.getByRole('link', {name: productName}),
      }),
    }),
  }
}

export type StudentSalesPageModel = ReturnType<typeof createStudentSalesPageModel>
