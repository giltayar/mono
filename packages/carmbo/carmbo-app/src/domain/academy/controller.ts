import {requestContext} from '@fastify/request-context'
import {finalHtml, type ControllerResult} from '../../commons/controller-result.ts'
import {listAcademyCourses} from './model.ts'
import {renderAcademyCourseOptions} from './view/list-searches.ts'
import {AcademyCoursesDatalist} from './view/form.ts'
import {html} from '../../commons/html-templates.ts'
import {generateItemTitle} from '../../commons/view-commons.ts'

export async function showAcademyCourseDatalist(
  subdomain: string,
  q: string | undefined,
): Promise<ControllerResult> {
  const academyIntegration = requestContext.get('academyIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  if (!academyIntegration) {
    return finalHtml('')
  }
  q = q?.trim() ?? ''

  const allCourses = await listAcademyCourses(academyIntegration, subdomain, now)
  const lowerQ = q.toLowerCase()
  const filtered = q
    ? allCourses.filter(
        (course) =>
          course.name.toLowerCase().includes(lowerQ) ||
          generateItemTitle(course.id, course.name).toLowerCase().includes(lowerQ),
      )
    : allCourses

  return finalHtml(renderAcademyCourseOptions(filtered))
}

export async function showAcademyCoursesDatalist(
  academyCourse: {courseId?: number; accountSubdomain?: string},
  academyCourseIndex: number,
): Promise<ControllerResult> {
  const academyIntegration = requestContext.get('academyIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  if (!academyIntegration) {
    return finalHtml('')
  }

  const courses = academyCourse.accountSubdomain
    ? await listAcademyCourses(academyIntegration, academyCourse.accountSubdomain, now)
    : []

  return finalHtml(
    html`<${AcademyCoursesDatalist} index=${academyCourseIndex} courses=${courses} />`,
  )
}
