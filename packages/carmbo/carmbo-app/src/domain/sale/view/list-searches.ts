import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'

export function renderSalesEventListPage(salesEvents: {salesEventNumber: number; name: string}[]) {
  return html`${salesEvents.map(
    (se) =>
      html`<option data-id=${se.salesEventNumber}>
        ${generateItemTitle(se.salesEventNumber, se.name)}
      </option>`,
  )}`
}

export function renderStudentListPage(students: {studentNumber: number; name: string}[]) {
  return html`${students.map(
    (student) =>
      html`<option data-id=${student.studentNumber}>
        ${generateItemTitle(student.studentNumber, student.name)}
      </option>`,
  )}`
}

export function renderProductListPage(products: {productNumber: number; name: string}[]) {
  return html`${products.map(
    (product) =>
      html`<option data-id=${product.productNumber}>
        ${generateItemTitle(product.productNumber, product.name)}
      </option>`,
  )}`
}
