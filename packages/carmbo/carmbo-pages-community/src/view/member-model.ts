import {z} from 'zod'

export const MemberRolesViewSchema = z.object({
  expectedHistoryId: z.string(),
  poster: z.string().default(''),
  liveStreamer: z.string().default(''),
  moderator: z.string().default(''),
  userBlocker: z.string().default(''),
  userApprover: z.string().default(''),
})
export type MemberRolesView = z.infer<typeof MemberRolesViewSchema>

export const NewMemberViewSchema = MemberRolesViewSchema.omit({expectedHistoryId: true}).extend({
  studentNumber: z.string().default(''),
})
export type NewMemberView = z.infer<typeof NewMemberViewSchema>

export const MemberActionViewSchema = z.object({
  expectedHistoryId: z.string(),
  action: z.string(),
  reasonText: z.string().default(''),
})
export type MemberActionView = z.infer<typeof MemberActionViewSchema>

export const NewMemberStudentViewSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().default(''),
})
export type NewMemberStudentView = z.infer<typeof NewMemberStudentViewSchema>

export interface StudentChoiceView {
  studentNumber: number
  name: string
  email: string
}

export interface MemberView extends StudentChoiceView {
  historyId: string
  enteredAt: string
  poster: string
  liveStreamer: string
  moderator: string
  userBlocker: string
  userApprover: string
  status: string
  reasonCode: string
  reasonText: string
  registrationEmailSentAt: string
}

export interface MemberHistoryView {
  historyId: string
  timestamp: string
  operation: string
  operationReason: string
}

export interface MemberPageView {
  communityNumber: number
  communityName: string
  readOnly: boolean
  historical: boolean
  currentHistoryId: string
  member: MemberView
  history: MemberHistoryView[]
  actions: string[]
}

export interface MemberListView {
  communityNumber: number
  communityName: string
  readOnly: boolean
  members: MemberView[]
  page: number
  query: string
}
