export interface RavmesserContact {
  firstName: string
  lastName: string
  email: string
  telephone: string | undefined
  birthday: Date | undefined
}

export interface RavmesserContactWithIdAndLists extends RavmesserContact {
  id: number
  lists_Linked: number[]
}

/** Listing a list's subscribers does not report their other lists */
export interface RavmesserContactInList extends RavmesserContact {
  id: number
  signupDate: Date
}

export interface RavmesserContactChangeListsOptions {
  subscribeTo: number[]
  unsubscribeFrom: number[]
}

export interface RavmesserFetchContactOptions {
  by?: 'id' | 'email'
}

/** Keyed by RavMesser personal-field id */
export type RavmesserCustomFields = Record<number, string | boolean | number | Date>

export interface RavmesserList {
  id: number
  name: string
}
