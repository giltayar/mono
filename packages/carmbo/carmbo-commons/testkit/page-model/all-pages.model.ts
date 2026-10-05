import type {Page} from '@playwright/test'

export function createAllPagesPageModel(page: Page) {
  return {
    documentElement: () => ({locator: page.locator('html')}),
    assets: () => ({
      locator: page.locator('link[rel="stylesheet"][href], script[src], img[src], object[data]'),
    }),
    header: () => ({
      errorBanner: (locator = page.getByRole('alert')) => ({locator}),
      menu: (menuLocator = page.getByRole('navigation')) => ({
        locator: menuLocator,
        studentsMenuItem: (locator = menuLocator.getByRole('menuitem', {name: 'Students'})) => ({
          locator,
        }),
        productsMenuItem: (locator = menuLocator.getByRole('menuitem', {name: 'Products'})) => ({
          locator,
        }),
        salesEventMenuItem: (
          locator = menuLocator.getByRole('menuitem', {name: 'Sales Events'}),
        ) => ({locator}),
        salesMenuItem: (locator = menuLocator.getByRole('menuitem', {name: 'Sales'})) => ({
          locator,
        }),
      }),
    }),
  }
}
