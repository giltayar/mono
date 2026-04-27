import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'

export function AcademyCoursesDatalist({
  index,
  courses,
}: {
  index: number
  courses: {id: number; name: string}[]
}) {
  return html`
    <datalist id="academy-courses-list-${index}">
      ${courses.map(
        (course) =>
          html`<option data-id=${course.id} value=${generateItemTitle(course.id, course.name)} />`,
      )}
    </datalist>
  `
}
