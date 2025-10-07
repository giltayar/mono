export function normalizePhoneNumber(phoneNumber: string): string {
  phoneNumber = phoneNumber.replace(/[^0-9\+]/g, '')

  if (phoneNumber.startsWith('+')) {
    return phoneNumber.slice(1)
  }

  if (phoneNumber.startsWith('0')) {
    phoneNumber = '972' + phoneNumber.slice(1)
  } else if (!phoneNumber.startsWith('972')) {
    phoneNumber = '972' + phoneNumber
  }

  if (phoneNumber.startsWith('972') && phoneNumber.charAt(3) === '0') {
    phoneNumber = phoneNumber.slice(0, 3) + phoneNumber.slice(4)
  }
  return phoneNumber
}

export function displayNormalizedPhoneNumber(normalizedPhoneNumber: string): string {
  if (!normalizedPhoneNumber.startsWith('972')) {
    return '+' + normalizedPhoneNumber
  } else {
    return '0' + normalizedPhoneNumber.slice(3)
  }
}
