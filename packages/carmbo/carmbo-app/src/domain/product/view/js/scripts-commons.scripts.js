/**
 * @param {import('@giltayar/carmel-tools-academy-integration/service').AcademyCourse | undefined} course
 */
export function generateAcademyCourseTitle(course) {
  if (!course) {
    return '???'
  }
  return `${course.id}: ${course.name}`
}
