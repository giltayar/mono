import type {Page} from '@playwright/test'

export function saleFormPageModel(page: Page, locator = page.locator('form')) {
  return {
    locator,
    salesEventInput: (inputLocator = locator.getByLabel('Sales Event')) => ({
      locator: inputLocator,
      link: (linkLocator = locator.getByRole('link', {name: 'View sales event'})) => ({
        locator: linkLocator,
      }),
    }),
    studentInput: (inputLocator = locator.getByLabel('Student')) => ({
      locator: inputLocator,
      link: (linkLocator = locator.getByRole('link', {name: 'View student'})) => ({
        locator: linkLocator,
      }),
    }),
    finalSaleRevenueInput: (inputLocator = locator.getByLabel('Final Sale Revenue')) => ({
      locator: inputLocator,
    }),
    cardcomInvoiceNumberInput: (inputLocator = locator.getByLabel('Cardcom Invoice Number')) => ({
      locator: inputLocator,
    }),
    transactionDescriptionInput: (inputLocator = locator.getByLabel('Description')) => ({
      locator: inputLocator,
    }),
    viewInvoiceLink: (linkLocator = locator.getByRole('link', {name: 'View Invoice'})) => ({
      locator: linkLocator,
    }),
    products: (
      productsLocator = locator.getByRole('group', {name: 'Products'}).getByRole('group'),
    ) => ({
      locator: productsLocator,
      product: (index: number, productLocator = productsLocator.nth(index)) => ({
        locator: productLocator,
        title: (titleLocator = productLocator.locator('legend h6')) => ({
          locator: titleLocator,
        }),
        link: (linkLocator = productLocator.getByRole('link', {name: 'View product'})) => ({
          locator: linkLocator,
        }),
        quantity: (quantityLocator = productLocator.getByLabel('Quantity')) => ({
          locator: quantityLocator,
        }),
        unitPrice: (priceLocator = productLocator.getByLabel('Unit Price')) => ({
          locator: priceLocator,
        }),
      }),
    }),
    hasDeliveryAddressCheckbox: (checkboxLocator = locator.getByLabel('Has Delivery')) => ({
      locator: checkboxLocator,
    }),
    deliveryAddress: (addressLocator = locator.getByRole('group', {name: 'Delivery Address'})) => ({
      locator: addressLocator,
      streetInput: (streetLocator = addressLocator.getByLabel('Street', {exact: true})) => ({
        locator: streetLocator,
      }),
      streetNumberInput: (numberLocator = addressLocator.getByLabel('Street Number')) => ({
        locator: numberLocator,
      }),
      entranceInput: (entranceLocator = addressLocator.getByLabel('Entrance')) => ({
        locator: entranceLocator,
      }),
      cityInput: (cityLocator = addressLocator.getByLabel('City')) => ({
        locator: cityLocator,
      }),
      floorInput: (floorLocator = addressLocator.getByLabel('Floor')) => ({
        locator: floorLocator,
      }),
      apartmentNumberInput: (
        apartmentNumberLocator = addressLocator.getByLabel('Apartment Number'),
      ) => ({
        locator: apartmentNumberLocator,
      }),
      contactPhoneInput: (contactPhoneLocator = addressLocator.getByLabel('Contact Phone')) => ({
        locator: contactPhoneLocator,
      }),
      notesInput: (notesLocator = addressLocator.getByLabel('Notes')) => ({
        locator: notesLocator,
      }),
    }),
  }
}

export type SaleFormPageModel = ReturnType<typeof saleFormPageModel>
