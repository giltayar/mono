document.addEventListener('click', (event) => {
  const target = event.target

  if (!target || !('parentElement' in target)) return

  const targetElement = /** @type {HTMLElement} */ (target)

  if (targetElement.classList.contains('students-view_trash')) {
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
  const birthday = event.detail.parameters.birthday

  if (!birthday) {
    delete event.detail.parameters.birthday
  }
})
