import {html} from '@giltayar/carmbo-common/commons/html-templates'
import {generateItemTitle} from '@giltayar/carmbo-common/commons/view-commons'

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
