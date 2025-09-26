import assert from 'node:assert'
import type {NewStudent, Student} from './model.ts'

export type StudentManipulations = {
  addItem: string | string[] | undefined
}

export function manipulateStudent<T extends NewStudent | Student>(
  student: T,
  manipulations: StudentManipulations,
): T {
  const transformed = {...student}
  const addItem = Array.isArray(manipulations.addItem) ? undefined : manipulations.addItem
  assert(
    addItem === undefined || ARRAY_FIELDS_IN_STUDENT.includes(addItem),
    `Invalid addItem: ${addItem}`,
  )

  if (addItem) {
    if (addItem === 'names') {
      ;(transformed[addItem] ??= []).push({firstName: '', lastName: ''})
    } else {
      // @ts-expect-error dynamic stuff!
      ;(transformed[addItem] ??= []).push('')
    }
  }

  return transformed
}

const ARRAY_FIELDS_IN_STUDENT = ['names', 'emails', 'phones', 'facebookNames']
