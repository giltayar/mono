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
