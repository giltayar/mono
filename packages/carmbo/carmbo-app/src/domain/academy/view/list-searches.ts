import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {generateItemTitle} from '@giltayar/carmbo-commons/commons/view-commons'

export function renderAcademyCourseOptions(courses: {id: number; name: string}[]) {
  return html`${courses.map(
    (course) =>
      html`<option data-id=${course.id}>${generateItemTitle(course.id, course.name)}</option>`,
  )}`
}
