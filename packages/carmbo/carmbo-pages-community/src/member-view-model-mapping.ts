import type {Member, MemberHistory, Roles} from './member-model.ts'
import type {MemberHistoryView, MemberRolesView, MemberView} from './view/member-model.ts'

export function memberToView(member: Member): MemberView {
  return {
    studentNumber: member.studentNumber,
    name: member.name,
    email: member.email,
    historyId: member.historyId,
    enteredAt: member.enteredAt.toISOString(),
    poster: member.poster ? 'on' : '',
    liveStreamer: member.liveStreamer ? 'on' : '',
    moderator: member.moderator ? 'on' : '',
    userBlocker: member.userBlocker ? 'on' : '',
    userApprover: member.userApprover ? 'on' : '',
    status: member.status,
    reasonCode: member.reasonCode ?? '',
    reasonText: member.reasonText ?? '',
    registrationEmailSentAt: member.registrationEmailSentAt?.toISOString() ?? '',
  }
}

export function viewToRoles(view: Omit<MemberRolesView, 'expectedHistoryId'>): Roles {
  return {
    poster: view.poster === 'on',
    liveStreamer: view.liveStreamer === 'on',
    moderator: view.moderator === 'on',
    userBlocker: view.userBlocker === 'on',
    userApprover: view.userApprover === 'on',
  }
}

export function historyToView(history: MemberHistory[]): MemberHistoryView[] {
  return history.map((entry) => ({
    ...entry,
    timestamp: entry.timestamp.toISOString(),
    operationReason: entry.operationReason ?? '',
  }))
}
