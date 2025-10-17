document.addEventListener('change', (/** @type {any} */ event) => {
  const target = event.target

  if (target && target.classList.contains('pick-item-title')) {
    const element = /** @type {HTMLInputElement} */ (target)
    const datalistId = element.getAttribute('list')
    const value = element.value
    const itemId = value.split(':', 1)[0].trim()
    const hiddenIdInput = document.getElementById(element.id + '_value')
    const datalist = document.getElementById(datalistId ?? '')
    const options = datalist?.children

    let found = false

    //@ts-expect-error - typescript is wrong and you can iterate over an HTMLCollection
    for (const option of options) {
      if (option instanceof HTMLOptionElement && option.getAttribute('data-id') == itemId) {
        found = true
        break
      }
    }
    console.log('setting custom validity', !found)
    element.setCustomValidity(found ? '' : 'Please select a valid item from the list')

    hiddenIdInput?.setAttribute('value', itemId.toString())
  }
})
document.addEventListener('input', (/** @type {any} */ event) => {
  const target = event.target

  if (target && target.classList.contains('pick-item-title')) {
    target.setCustomValidity('')
  }
})

document.addEventListener('input', async (event) => {
  const inputElement = /**@type {HTMLInputElement} */ (event.target)

  if (!inputElement.classList.contains('pick-item-title-async')) return

  const datalist = inputElement.list

  if (!datalist) return

  const fetchUrlString = inputElement.getAttribute('data-list-fetch')

  if (!fetchUrlString || !/^[a-zA-Z0-9\-/]+$/.test(fetchUrlString)) return

  const salesEventOptions = await fetch(
    `${fetchUrlString}?q=${encodeURIComponent(/**@type {HTMLInputElement} */ (event.target).value)}`,
  ).then((r) => r.text())

  datalist.innerHTML = salesEventOptions
})

document.addEventListener('change', async (event) => {
  const inputElement = /**@type {HTMLInputElement} */ (event.target)

  if (!inputElement.classList.contains('pick-item-title-async')) return

  const datalist = inputElement.list

  if (!datalist) return

  const valueElement = /**@type {HTMLInputElement | null} */ (
    document.getElementById(inputElement.id + '_value')
  )

  if (!valueElement) return

  const itemId = parseInt(inputElement.value.split(':')[0])

  if (!itemId) return

  const itemIdAsString = itemId.toString()

  valueElement.value = itemIdAsString

  const options = datalist?.children
  let found = false
  //@ts-expect-error - typescript is wrong and you can iterate over an HTMLCollection
  for (const option of options) {
    if (option instanceof HTMLOptionElement && option.getAttribute('data-id') == itemIdAsString) {
      found = true
      break
    }
  }

  inputElement.setCustomValidity(found ? '' : 'Please select a valid item from the list')
  inputElement.reportValidity()

  inputElement.dispatchEvent(new Event('change'))
})
