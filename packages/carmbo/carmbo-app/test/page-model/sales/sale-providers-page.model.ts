import type {Locator, Page} from '@playwright/test'
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
              name: new RegExp(`${RegExp.escape(courseId)}: .*`, 'i'),
              exact: true,
            }),
          ) => ({
            locator: checkboxLocator,
          }),
          courseName: (
            courseId: string,
            nameLocator = cardLocator.getByText(new RegExp(`${RegExp.escape(courseId)}: .*`, 'i')),
          ) => ({
            locator: nameLocator,
          }),
        }),
        smooveLists: (listLocator = cardLocator.locator('[aria-labelledby=smoove-lists-header]')) =>
          mailingListCheckboxes(listLocator),
        ravmesserLists: (
          listLocator = cardLocator.locator('[aria-labelledby=ravmesser-lists-header]'),
        ) => mailingListCheckboxes(listLocator),
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

function mailingListCheckboxes(listLocator: Locator) {
  return {
    locator: listLocator,
    mainListCheckbox: (
      locator = listLocator.getByRole('checkbox', {name: /^Main list \(.*\)/i}),
    ) => ({
      locator,
    }),
    mainListName: (locator = listLocator.getByText(/^Main list \(.*\)/i)) => ({locator}),
    cancelledListCheckbox: (
      locator = listLocator.getByRole('checkbox', {name: /^Cancelled list \(.*\)/i}),
    ) => ({locator}),
    cancelledListName: (locator = listLocator.getByText(/^Cancelled list \(.*\)/i)) => ({
      locator,
    }),
    removedListCheckbox: (
      locator = listLocator.getByRole('checkbox', {name: /^Removed list \(.*\)/i}),
    ) => ({locator}),
    removedListName: (locator = listLocator.getByText(/^Removed list \(.*\)/i)) => ({
      locator,
    }),
  }
}
