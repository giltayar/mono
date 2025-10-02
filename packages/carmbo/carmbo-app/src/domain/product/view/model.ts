import {z} from 'zod'
import {ProductTypeSchema} from '../model.ts'

export const OngoingProductSchema = z.object({
  name: z.string().optional(),
  productType: ProductTypeSchema,
  academyCourses: z.array(z.coerce.number().int().positive().optional()).optional(),
  whatsappGroups: z
    .array(
      z.object({
        id: z.string().optional(),
        timedMessagesGoogleSheetUrl: z.string().optional(),
      }),
    )
    .optional(),
  facebookGroups: z.array(z.string().optional()).optional(),
  smooveListId: z.coerce.number().int().positive().optional(),
  smooveCancellingListId: z.coerce.number().int().positive().optional(),
  smooveCancelledListId: z.coerce.number().int().positive().optional(),
  smooveRemovedListId: z.coerce.number().int().positive().optional(),
  cardcomProductId: z.string().optional(),
})
export type OngoingProduct = z.infer<typeof OngoingProductSchema>
