import {z} from 'zod'
import type {HistoryOperation} from '@giltayar/carmbo-commons/commons/operation-type'

// What the UI sends and what views render: no id, every field is a string, and no validation.
export const CommunityViewSchema = z.object({
  name: z.string(),
  description: z.string(),
})

export type CommunityView = z.infer<typeof CommunityViewSchema>

export interface CommunityListItemView {
  communityNumber: number
  community: CommunityView
}

export interface CommunityHistoryEntryView {
  historyId: string
  operation: HistoryOperation
  timestamp: Date
}

export interface CommunityPageView {
  communityNumber: number
  historyId: string
  historyOperation: HistoryOperation
  community: CommunityView
  history: CommunityHistoryEntryView[]
}
