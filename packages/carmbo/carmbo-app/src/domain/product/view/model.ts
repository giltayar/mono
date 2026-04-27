import {z} from 'zod'
import {ProductTypeSchema} from '../model.ts'
import {itemPickerSchema, stringItemPickerSchema} from '../../../commons/schema-commons.ts'

export const OngoingProductSchema = z.object({
  name: z.string().optional(),
  productType: ProductTypeSchema,
  academyCourses: z
    .array(
      z.object({
        courseId: itemPickerSchema(),
        accountSubdomain: z.string().min(1).optional(),
      }),
    )
    .optional(),
  whatsappGroups: z
    .array(
      z.object({
        id: stringItemPickerSchema(),
        timedMessagesGoogleSheetUrl: z.string().optional(),
      }),
    )
    .optional(),
  facebookGroups: z.array(z.string().optional()).optional(),
  smooveListId: itemPickerSchema(),
  smooveCancelledListId: itemPickerSchema(),
  smooveRemovedListId: itemPickerSchema(),
  sendSkoolInvitation: z.coerce.boolean().optional(),
  personalMessageWhenJoining: z.string().optional(),
  notes: z.string().optional(),
})
export type OngoingProduct = z.infer<typeof OngoingProductSchema>
