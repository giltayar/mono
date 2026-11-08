import {z} from 'zod'
import type {EmailResultHandler} from '@giltayar/carmbo-pages-email/jobs'
import {recordRegistrationEmailResult} from './member-model.ts'

const RegistrationEmailPayloadSchema = z.object({
  communityNumber: z.number().int().positive(),
  studentNumber: z.number().int().positive(),
})

// Register as the `registration-email` result handler of the host's email job.
export const handleRegistrationEmailResult: EmailResultHandler = async ({
  emailNumber,
  payload,
  result,
  now,
  tx,
}) => {
  const {communityNumber, studentNumber} = RegistrationEmailPayloadSchema.parse(payload)
  await recordRegistrationEmailResult(communityNumber, studentNumber, emailNumber, result, now, tx)
}
