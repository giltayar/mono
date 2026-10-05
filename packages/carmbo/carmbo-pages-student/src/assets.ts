export const studentStyles = `.students-view {
  h1 {
    margin-right: auto;
  }

  table {
    table-layout: fixed;

    tr td:nth-child(1), th:nth-child(1) {
      width: 4rem;
    }

    td:nth-child(1) {
      text-align: right;
    }
  }

  section.add-new {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
  }
}
`

export const studentScripts = `document.addEventListener('click', (event) => {
  const target = event.target

  if (!target || !('parentElement' in target)) return

  const targetElement = target

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

document.addEventListener('htmx:configRequest', (event) => {
  const birthday = event.detail.parameters.birthday

  if (!birthday) {
    delete event.detail.parameters.birthday
  }
})
`
