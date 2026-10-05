document.addEventListener('click', (event) => {
  const target = event.target

  if (!target || !('parentElement' in target)) return

  const targetElement = /** @type {HTMLElement} */ (target)

  if (targetElement.classList.contains('discard')) {
    window.location.reload()
    event.preventDefault()
    targetElement.closest('form')?.reset()
  }
})
