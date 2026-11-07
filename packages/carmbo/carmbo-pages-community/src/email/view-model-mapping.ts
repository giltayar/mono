import type {Email} from './model.ts'
import type {EmailView} from './view/model.ts'

export function emailToView(email: Email): EmailView {
  return {
    emailNumber: String(email.emailNumber),
    purpose: email.purpose,
    toEmail: email.toEmail,
    fromEmail: email.fromEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    language: email.language,
    tags: JSON.stringify(email.tags),
    jobId: String(email.jobId),
    resendEmailId: email.resendEmailId ?? '',
    createdAt: email.createdAt.toISOString(),
    deliveredAt: email.deliveredAt?.toISOString() ?? '',
    successAt: email.successAt?.toISOString() ?? '',
    retryTimestamps: [...email.retryTimestamps],
    sendingTimestamps: [...email.sendingTimestamps],
    status: email.status,
    errorText: email.errorText ?? '',
    communityNumber: email.communityNumber === null ? '' : String(email.communityNumber),
    communityName: email.communityName ?? '',
    studentNumber: email.studentNumber === null ? '' : String(email.studentNumber),
    studentName: email.studentName ?? '',
  }
}
