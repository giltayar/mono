document.addEventListener('click', (event) => {
  const target = event.target

  if (target.classList.contains('students-view_trash')) {
    target.parentElement.querySelectorAll('*[name]').forEach((el) => {
      el.removeAttribute('name')
    })
  }
})
