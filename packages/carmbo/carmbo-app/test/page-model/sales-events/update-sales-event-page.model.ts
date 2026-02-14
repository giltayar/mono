import type {Page} from '@playwright/test'
import {salesEventFormPageModel} from './sales-event-form.model.ts'
import {createSalesEventHistoryPageModel} from './sales-event-history.model.ts'
import {createAllPagesPageModel} from '../common/all-pages.model.ts'

export function createUpdateSalesEventPageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/sales-events\/\d+$/,
    pageTitle: (locator = page.getByRole('heading', {name: /Update Sales Event \d+/})) => ({
      locator,
    }),
    form: () => ({
      updateButton: (btnLocator = page.getByRole('button', {name: 'Update'})) => ({
        locator: btnLocator,
      }),
      discardButton: (btnLocator = page.getByRole('button', {name: 'Discard'})) => ({
        locator: btnLocator,
      }),
      deleteButton: (btnLocator = page.getByRole('button', {name: 'Archive'})) => ({
        locator: btnLocator,
      }),
      restoreButton: (btnLocator = page.getByRole('button', {name: 'Restore'})) => ({
        locator: btnLocator,
      }),

      ...salesEventFormPageModel(page),
    }),
    cardcomInformation: () => ({
      webhookUrlInput: (inputLocator = page.getByLabel('CardCom Webhook URL')) => ({
        locator: inputLocator,
      }),
    }),
    smooveInformation: () => ({
      webhookUrlInput: (inputLocator = page.getByLabel('Smoove Webhook URL')) => ({
        locator: inputLocator,
      }),
      importFromSmooveButton: (
        btnLocator = page.getByRole('button', {name: 'Import from Smoove'}),
      ) => ({
        locator: btnLocator,
      }),
    }),
    importSmooveDialog: () => ({
      dialog: (dialogLocator = page.locator('#import-smoove-dialog')) => ({
        locator: dialogLocator,
      }),
      smooveListInput: (inputLocator = page.locator('#import-smooveListId')) => ({
        locator: inputLocator,
      }),
      smooveListHiddenInput: (inputLocator = page.locator('#import-smooveListId_value')) => ({
        locator: inputLocator,
      }),
      cancelButton: (
        btnLocator = page.locator('#import-smoove-dialog button', {hasText: 'Cancel'}),
      ) => ({
        locator: btnLocator,
      }),
      startImportButton: (btnLocator = page.locator('#import-smoove-start-btn')) => ({
        locator: btnLocator,
      }),
      resultsContainer: (containerLocator = page.locator('#import-smoove-results')) => ({
        locator: containerLocator,
      }),
      closeButton: (
        btnLocator = page.locator('#import-smoove-results button', {hasText: 'Close'}),
      ) => ({
        locator: btnLocator,
      }),
    }),
    history: () => createSalesEventHistoryPageModel(page),
  }
}

export type UpdateSalesEventPageModel = ReturnType<typeof createUpdateSalesEventPageModel>
