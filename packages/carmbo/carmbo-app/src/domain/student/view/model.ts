import {z} from 'zod'

export const OngoingStudentSchema = z.object({
  birthday: z.iso
    .date()
    .transform((s) => new Date(s))
    .optional(),
  names: z
    .array(z.object({firstName: z.string().optional(), lastName: z.string().optional()}).optional())
    .optional(),
  emails: z.array(z.string().optional()).optional(),
  phones: z.array(z.string().optional()).optional(),
  facebookNames: z.array(z.string().optional()).optional(),
})
export type OngoingStudent = z.infer<typeof OngoingStudentSchema>
