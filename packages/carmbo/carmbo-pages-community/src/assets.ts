export const communityStyles = `.communities-view {
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

export const communityScripts = `document.addEventListener('click', (event) => {
  const target = event.target

  if (!target || !('classList' in target)) return

  if (target.classList.contains('discard')) {
    window.location.reload()
    event.preventDefault()
    target.closest('form')?.reset()
  }
})
`
