export interface SmooveContact {
  id: number
  email: string
  telephone: string
  cardcomRecurringPaymentId: string
  cardcomAccountId: string
  cardcomRecurringPaymentStartDate: Date
  lists_Linked: number[]
}

export interface SmooveContactInList extends SmooveContact {
  signupDate: Date
}

export interface SmooveContactChangeListsOptions {
  subscribeTo: number[]
  unsubscribeFrom: number[]
}

export interface SmooveFetchContactOptions {
  by?: 'id' | 'email'
}
