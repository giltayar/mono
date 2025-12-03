import {html} from '../../../commons/html-templates.ts'
import {Tabs} from './layout.ts'
import type {SaleWithProviders} from '../model/model-external-providers.ts'

export function SaleProvidersView({sale}: {sale: SaleWithProviders}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">Sale ${sale.saleNumber} Payments</h2>
    <${Tabs} saleNumber=${sale.saleNumber} activeTab="providers" />
    ${sale.products.map(
      (product) => html`
        <div class="card mb-5" aria-label="product">
          <div class="card-body" aria-labelledby="product-${product.productNumber}-title">
            <h5 class="card-title" id="product-${product.productNumber}-stitle">
              Product ${product.productNumber}: ${product.productName}
            </h5>
            <div class="card-header" id="academy-courses-header">Academy courses</div>
            <ul class="list-group list-group-flush" aria-labelledby="academy-courses-header">
              ${product.academyCourses.map(
                (academyCourse) => html`
                  <li class="list-group-item">
                    <div class="form-check">
                      <input
                        id="academy-course-${academyCourse.courseId}"
                        class="form-check-input"
                        type="checkbox"
                        onclick="return false"
                        checked=${academyCourse.isConnected}
                      />
                      <label class="form-check-label" for="academy-course-${academyCourse.courseId}"
                        >${academyCourse.courseId}: ${academyCourse.name}</label
                      >
                    </div>
                  </li>
                `,
              )}
            </ul>
            <div class="card-header" id="smoove-lists-header">Smoove lists</div>
            <ul class="list-group list-group-flush" aria-labelledby="smoove-lists-header">
              <li class="list-group-item">
                <div class="form-check">
                  <input
                    id="smoove-list-main"
                    class="form-check-input"
                    type="checkbox"
                    onclick="return false"
                    checked=${product.smooveLists.isListConnected}
                  />
                  <label class="form-check-label" for="smoove-list-main"
                    >Main list (${product.smooveLists.listName})</label
                  >
                </div>
              </li>
              <li class="list-group-item">
                <div class="form-check">
                  <input
                    id="smoove-list-cancelled"
                    class="form-check-input"
                    type="checkbox"
                    onclick="return false"
                    checked=${product.smooveLists.isCancelledListConnected}
                  />
                  <label class="form-check-label" for="smoove-list-cancelled"
                    >Cancelled list (${product.smooveLists.cancelledListName})</label
                  >
                </div>
              </li>
              <li class="list-group-item">
                <div class="form-check">
                  <input
                    id="smoove-list-removed"
                    class="form-check-input"
                    type="checkbox"
                    onclick="return false"
                    checked=${product.smooveLists.isRemovedListConnected}
                  />
                  <label class="form-check-label" for="smoove-list-removed"
                    >Removed list (${product.smooveLists.removedListName})</label
                  >
                </div>
              </li>
            </ul>
            <div class="card-header" id="whatsap-groups-header">WhatsApp groups</div>
            <ul class="list-group list-group-flush" aria-labelledby="whatsap-groups-header">
              ${product.whatsAppGroups.map(
                (whatsAppGroup) => html`
                  <li class="list-group-item">
                    <div class="form-check">
                      <input
                        id="whatsap-group-${whatsAppGroup.groupId}"
                        class="form-check-input"
                        type="checkbox"
                        onclick="return false"
                        checked=${whatsAppGroup.isConnected}
                      />
                      <label class="form-check-label" for="whatsap-group-${whatsAppGroup.groupId}"
                        >${whatsAppGroup.groupId}: ${whatsAppGroup.name}</label
                      >
                    </div>
                  </li>
                `,
              )}
            </ul>
          </div>
        </div>
      `,
    )}
  `
}
