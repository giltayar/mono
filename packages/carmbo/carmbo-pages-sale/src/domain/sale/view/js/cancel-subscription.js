const form = /** @type {HTMLFormElement } */ (document.getElementById('cancel-subscription-form'))
const dialog = /** @type {HTMLDialogElement } */ (document.getElementById('confirm-dialog'))
const confirmYes = /** @type {HTMLButtonElement } */ (document.getElementById('confirm-yes'))
const confirmNo = /** @type {HTMLButtonElement } */ (document.getElementById('confirm-no'))

form.addEventListener('submit', (e) => {
  e.preventDefault()
  dialog.showModal()
})

confirmYes.addEventListener('click', () => {
  dialog.close()
  form.submit()
})

confirmNo.addEventListener('click', () => {
  dialog.close()
})
