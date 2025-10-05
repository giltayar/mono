import {z} from 'zod'

export const OngoingSalesEventSchema = z.object({
  name: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  landingPageUrl: z.string().optional(),
  productsForSale: z.array(z.coerce.number().int().positive().optional()).optional(),
})
export type OngoingSalesEvent = z.infer<typeof OngoingSalesEventSchema>
