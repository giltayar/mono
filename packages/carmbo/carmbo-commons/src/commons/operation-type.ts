import {z} from 'zod'

export const HistoryOperationEnumSchema = z.enum(['create', 'update', 'delete', 'restore'])

export type HistoryOperation = z.infer<typeof HistoryOperationEnumSchema>
