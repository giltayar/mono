export interface EmailView {
  emailNumber: string
  purpose: 'registration-email'
  toEmail: string
  fromEmail: string
  subject: string
  html: string
  text: string
  language: string
  tags: string
  jobId: string
  resendEmailId: string
  createdAt: string
  deliveredAt: string
  successAt: string
  retryTimestamps: string[]
  sendingTimestamps: string[]
  status: 'sending' | 'retrying' | 'delivered' | 'success' | 'failure'
  errorText: string
  communityNumber: string
  communityName: string
  studentNumber: string
  studentName: string
}
