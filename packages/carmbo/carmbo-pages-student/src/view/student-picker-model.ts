import {z} from 'zod'

export const PickerTargetSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/)

export const PickerStudentViewSchema = z.object({
  firstName: z.string().default(''),
  lastName: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
})
export type PickerStudentView = z.infer<typeof PickerStudentViewSchema>

export interface StudentPickerSelection {
  studentNumber: number
  name: string
  email: string
  phone: string
}

export interface StudentPickerOptions {
  targetFieldId: string
  basePath?: string
}
