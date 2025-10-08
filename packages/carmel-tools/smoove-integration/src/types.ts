export interface SmooveContact {
  firstName: string
  lastName: string
  email: string
  telephone: string | undefined
  birthday: Date | undefined
}

export interface SmooveContactWithIdAndLists extends SmooveContact {
  id: number
  lists_Linked: number[]
}

export interface SmooveContactInList extends SmooveContact {
  id: number
  signupDate: Date
  lists_Linked: number[]
}

export interface SmooveContactChangeListsOptions {
  subscribeTo: number[]
  unsubscribeFrom: number[]
}

export interface SmooveFetchContactOptions {
  by?: 'id' | 'email'
}

export interface SmooveList {
  id: number
  name: string
}
