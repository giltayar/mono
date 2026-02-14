document.addEventListener('click', (event) => {
  const target = event.target

  if (!target || !('parentElement' in target)) return

  const targetElement = /** @type {HTMLElement} */ (target)

  if (targetElement.classList.contains('sales-events-view_trash')) {
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

// Show dialog when import-smoove-dialog is loaded
document.addEventListener('htmx:afterSwap', (/** @type {any} */ event) => {
  if (event.detail.target.id === 'import-smoove-dialog-container') {
    const dialog = document.getElementById('import-smoove-dialog')
    if (dialog && dialog instanceof HTMLDialogElement) {
      dialog.showModal()
    }
  }
})
