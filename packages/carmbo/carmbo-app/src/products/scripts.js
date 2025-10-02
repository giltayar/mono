document.addEventListener('click', (event) => {
  const target = event.target

  if (!target || !('parentElement' in target)) return

  const targetElement = /** @type {HTMLElement} */ (target)

  if (targetElement.classList.contains('products-view_trash')) {
    targetElement.parentElement?.querySelectorAll('*[name]').forEach((el) => {
      el.removeAttribute('name')
    })
  }

  if (targetElement.classList.contains('discard')) {
    window.location.reload()
    event.preventDefault()
    targetElement.closest('form')?.reset()
  }
})

document.addEventListener('htmx:configRequest', (/** @type {any} */ event) => {
  for (const key in event.detail.parameters) {
    if (event.detail.parameters[key] === '') {
      delete event.detail.parameters[key]
    }
  }
})

document.addEventListener('change', (/** @type {any} */ event) => {
  if (event.target && event.target.classList.contains('academy-course-title')) {
    const element = /** @type {HTMLInputElement} */ (event.target)
    const value = element.value
    const courseId = value.split(':', 1)[0].trim()
    const datalist = document.getElementById('academy-courses-list')
    const options = datalist?.children
    let found = false

    //@ts-expect-error - typescript is wrong and you can iterate over an HTMLCollection
    for (const option of options) {
      if (
        option instanceof HTMLOptionElement &&
        option.getAttribute('data-course-id') == courseId
      ) {
        found = true
        break
      }
    }
    element.setCustomValidity(found ? '' : 'Please select a valid course from the list')

    const hiddenInput = document.getElementById(element.id + '_value')

    hiddenInput?.setAttribute('value', courseId.toString())
  }
})
