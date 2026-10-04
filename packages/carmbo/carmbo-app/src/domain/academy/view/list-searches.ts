import {html} from '@giltayar/carmbo-common/commons/html-templates'
import {generateItemTitle} from '@giltayar/carmbo-common/commons/view-commons'

export function renderAcademyCourseOptions(courses: {id: number; name: string}[]) {
  return html`${courses.map(
    (course) =>
      html`<option data-id=${course.id}>${generateItemTitle(course.id, course.name)}</option>`,
  )}`
}
