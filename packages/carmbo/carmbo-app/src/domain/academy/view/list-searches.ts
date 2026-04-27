import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'

export function renderAcademyCourseOptions(courses: {id: number; name: string}[]) {
  return html`${courses.map(
    (course) =>
      html`<option data-id=${course.id}>${generateItemTitle(course.id, course.name)}</option>`,
  )}`
}
