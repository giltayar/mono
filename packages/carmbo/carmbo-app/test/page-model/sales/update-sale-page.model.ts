import type {Page} from '@playwright/test'
import {saleFormPageModel} from './sale-form.model.ts'
import {createSaleHistoryPageModel} from './sale-history.model.ts'
import {createAllPagesPageModel} from '../common/all-pages.model.ts'

export function createUpdateSalePageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/sales\/\d+$/,
    pageTitle: (locator = page.getByRole('heading', {level: 2})) => ({locator}),
    saleStatus: (locator = page.locator('.sale-title > div').last()) => ({locator}),
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
      connectButton: (btnLocator = page.getByRole('button', {name: 'Connect', exact: true})) => ({
        locator: btnLocator,
      }),
      reconnectButton: (btnLocator = page.getByRole('button', {name: 'Reconnect'})) => ({
        locator: btnLocator,
      }),
      refundButton: (
        btnLocator = page.locator('form.col-md-6').getByRole('button', {name: 'Refund'}),
      ) => ({locator: btnLocator}),
      disconnectButton: (btnLocator = page.getByRole('button', {name: 'Disconnect'})) => ({
        locator: btnLocator,
      }),

      ...saleFormPageModel(page),
    }),
    refundDialog: (dialogLocator = page.locator('#refund-dialog')) => ({
      locator: dialogLocator,
      fullRefundRadio: (locator = dialogLocator.getByRole('radio', {name: 'Refund all'})) => ({
        locator,
      }),
      partialRefundRadio: (
        locator = dialogLocator.getByRole('radio', {name: 'Refund partial'}),
      ) => ({locator}),
      amountInput: (locator = dialogLocator.getByRole('spinbutton', {name: 'Refund amount'})) => ({
        locator,
      }),
      refundButton: (
        locator = dialogLocator.getByRole('button', {name: 'Refund', exact: true}),
      ) => ({locator}),
      cancelButton: (locator = dialogLocator.getByRole('button', {name: 'Cancel'})) => ({locator}),
      warning: (locator = dialogLocator.getByRole('alert')) => ({locator}),
    }),
    history: () => createSaleHistoryPageModel(page),
  }
}

export type UpdateSalePageModel = ReturnType<typeof createUpdateSalePageModel>
