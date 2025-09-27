document.addEventListener('click', (event) => {
  const target = event.target

  if (target.classList.contains('students-view_trash')) {
    target.parentElement.querySelectorAll('*[name]').forEach((el) => {
      el.removeAttribute('name')
    })
  }

  if (target.classList.contains('discard')) {
    window.location.reload()
    event.preventDefault()
    event.target.closest('form').reset()
  }
})
