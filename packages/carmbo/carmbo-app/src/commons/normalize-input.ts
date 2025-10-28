export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizePhoneNumber(phoneNumber: string): string {
  phoneNumber = phoneNumber.replace(/[^0-9\+]/g, '')

  switch (true) {
    case phoneNumber.startsWith('+972') && phoneNumber.charAt(3) === '0':
      return phoneNumber.slice(4)
    case phoneNumber.startsWith('+972'):
      return '0' + phoneNumber.slice(4)
    case phoneNumber.startsWith('+'):
      return phoneNumber
    case phoneNumber.startsWith('972') && phoneNumber.charAt(3) === '0':
      return phoneNumber.slice(3)
    case phoneNumber.startsWith('972'):
      return '0' + phoneNumber.slice(3)
    case phoneNumber.startsWith('0'):
      return phoneNumber
    case phoneNumber.length === 9:
      return '0' + phoneNumber
    default:
      return phoneNumber
  }
}

export function normalizeName({firstName, lastName}: {firstName: string; lastName: string}): {
  firstName: string
  lastName: string
} {
  return {firstName: firstName.trim(), lastName: lastName.trim()}
}
