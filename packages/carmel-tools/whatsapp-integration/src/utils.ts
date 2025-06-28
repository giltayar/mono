import type {WhatsAppContactId} from './types.ts'

export function humanIsraeliPhoneNumberToWhatsAppId(phoneNumber: string): WhatsAppContactId {
  phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

  if (phoneNumber.startsWith('0')) {
    phoneNumber = '972' + phoneNumber.slice(1)
  } else if (!phoneNumber.startsWith('972')) {
    phoneNumber = '972' + phoneNumber
  }

  if (phoneNumber.charAt(3) === '0') {
    phoneNumber = phoneNumber.slice(0, 3) + phoneNumber.slice(4)
  }
  return `${phoneNumber}@c.us` as WhatsAppContactId
}
