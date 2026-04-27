import {z} from 'zod'
import {itemPickerSchema} from '../../../commons/schema-commons.ts'

export const OngoingSalesEventSchema = z.object({
  name: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  landingPageUrl: z.string().optional(),
  productsForSale: z.array(itemPickerSchema()).optional(),
  notes: z.string().optional(),
})
export type OngoingSalesEvent = z.infer<typeof OngoingSalesEventSchema>
