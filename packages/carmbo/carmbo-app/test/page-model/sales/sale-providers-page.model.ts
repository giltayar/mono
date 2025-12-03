import type {Page} from '@playwright/test'
import {createAllPagesPageModel} from '../common/all-pages.model.ts'

export function createSaleProvidersPageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/sales\/\d+\/providers$/,
    pageTitle: (locator = page.getByRole('heading', {level: 2})) => ({locator}),
    productCards: (cardsLocator = page.getByLabel('product')) => ({
      locator: cardsLocator,
      card: (index: number, cardLocator = cardsLocator.nth(index)) => ({
        locator: cardLocator,
        title: (titleLocator = cardLocator.getByRole('heading', {level: 5})) => ({
          locator: titleLocator,
        }),
        academyCourses: () => ({
          courseCheckbox: (
            courseId: string,
            checkboxLocator = cardLocator.getByRole('checkbox', {
              name: new RegExp(`^${courseId}: .*`, 'i'),
              exact: true,
            }),
          ) => ({
            locator: checkboxLocator,
          }),
          courseName: (
            courseId: string,
            nameLocator = cardLocator.getByText(new RegExp(`^${courseId}: .*`, 'i')),
          ) => ({
            locator: nameLocator,
          }),
        }),
        smooveLists: () => ({
          mainListCheckbox: (
            locator = cardLocator.getByRole('checkbox', {name: /^Main list \(.*\)/i}),
          ) => ({
            locator,
          }),
          mainListName: (locator = cardLocator.getByText(/^Main list \(.*\)/i)) => ({locator}),
          cancelledListCheckbox: (
            locator = cardLocator.getByRole('checkbox', {name: /^Cancelled list \(.*\)/i}),
          ) => ({locator}),
          cancelledListName: (locator = cardLocator.getByText(/^Cancelled list \(.*\)/i)) => ({
            locator,
          }),
          removedListCheckbox: (
            locator = cardLocator.getByRole('checkbox', {name: /^Removed list \(.*\)/i}),
          ) => ({locator}),
          removedListName: (locator = cardLocator.getByText(/^Removed list \(.*\)/i)) => ({
            locator,
          }),
        }),
        whatsAppGroups: () => ({
          groupCheckbox: (
            groupId: string,
            locator = cardLocator.getByRole('checkbox', {
              name: new RegExp(`^${groupId}: .*`, 'i'),
              exact: true,
            }),
          ) => ({locator}),
          groupName: (
            groupId: string,
            locator = cardLocator.getByText(new RegExp(`^${groupId}: .*$`, 'i')),
          ) => ({locator}),
        }),
      }),
    }),
  }
}

export type SaleProvidersPageModel = ReturnType<typeof createSaleProvidersPageModel>
