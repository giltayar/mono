import {z} from 'zod'
import {NewProductSchema} from '../model.ts'

export const OngoingProductSchema = NewProductSchema.partial()
export type OngoingProduct = z.infer<typeof OngoingProductSchema>
