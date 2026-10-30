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

  .member-student-dialog {
    width: min(38rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    border: 0;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1rem 3rem rgb(0 0 0 / 20%);
  }

  .member-student-dialog::backdrop {
    background: rgb(0 0 0 / 40%);
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
