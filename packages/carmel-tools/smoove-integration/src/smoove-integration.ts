// https://rest.smoove.io/#!/Account/Account_Get

import {throw_} from '@giltayar/functional-commons'

const SMOOVE_API_URL = 'https://rest.smoove.io/v1/'
const SMOOVE_API_KEY =
  process.env.SMOOVE_API_KEY ?? throw_(new Error('SMOOVE_API_KEY env variable must be defined'))

export interface SmooveContact {
  id: number;
  email: string;
  telephone: string;
  cardcomRecurringPaymentId: string;
  cardcomAccountId: string;
  cardcomRecurringPaymentStartDate: Date;
  lists_Linked: number[];
}

export interface SmooveContactInList extends SmooveContact {
  signupDate: Date;
}

export async function fetchContactsOfList(listId: number): Promise<SmooveContactInList[]> {
  let fullResults: any[] = []
  for (const i of Array.from({length: 100}, (_, i) => i)) {
    const result = await fetchByPage(i + 1)
    if (result.length === 0) {
      break
    }

    fullResults = [...fullResults, ...result]
  }

  return fullResults.map(
    (c: {
      id: number;
      email: string;
      phone: string;
      cellPhone: string;
      lists_Linked: number[];
      customFields: { i12: any; i13: any; i14: any };
      listAssociationTime: string;
    }) => ({
      id: c.id,
      email: c.email,
      cardcomRecurringPaymentId: c.customFields.i12,
      cardcomAccountId: c.customFields.i13,
      telephone: c.cellPhone || c.phone,
      cardcomRecurringPaymentStartDate: c.customFields.i14,
      signupDate: maybeIsoToDate(c.listAssociationTime),
      lists_Linked: c.lists_Linked,
    }),
  )

  async function fetchByPage(page: number): Promise<any[]> {
    const url = new URL(`Lists/${listId}/Contacts`, SMOOVE_API_URL)
    url.searchParams.append('fields', 'id,email,listAssociationTime,phone,cellPhone')
    url.searchParams.append('page', String(page))
    url.searchParams.append('itemsPerPage', String(100))
    url.searchParams.append('sort', '-id')
    url.searchParams.append('includeCustomFields', 'true')
    url.searchParams.append('includeLinkedLists', 'true')
    url.searchParams.append('includeListAssociationTime', 'true')

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SMOOVE_API_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}, ${await response.text()}`)
    }

    return await response.json() as any[]
  }
}

export async function fetchSmooveContact(id: string, {by = 'id'}: {by?: 'id' | 'email'} = {}): Promise<SmooveContact> {
  const url = new URL(`Contacts/${id}`, SMOOVE_API_URL)
  url.searchParams.append('by', by === 'id' ? 'ContactId' : 'Email')
  url.searchParams.append('fields', 'id,email,hokNumber,phone,cellPhone')
  url.searchParams.append('includeLinkedLists', 'true')
  url.searchParams.append('includeCustomFields', 'true')

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SMOOVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}, ${await response.text()}`)
  }

  const result = await response.json() as {
    id: number;
    email: string;
    lists_Linked: number[];
    customFields: { i12: string; i13: string; i14: string };
    cellPhone: string;
    phone: string;
  }

  return {
    id: result.id,
    email: result.email,
    lists_Linked: result.lists_Linked,
    cardcomRecurringPaymentId: result.customFields.i12,
    cardcomAccountId: result.customFields.i13,
    telephone: result.cellPhone || result.phone,
    cardcomRecurringPaymentStartDate: new Date(result.customFields.i14),
  }
}

export async function changeContactLinkedLists(
  smooveContact: SmooveContact,
  {subscribeTo, unsubscribeFrom}: {subscribeTo: number[]; unsubscribeFrom: number[]}
): Promise<unknown> {
  const url = new URL(`Contacts/${smooveContact.id}`, SMOOVE_API_URL)
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SMOOVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({lists_ToSubscribe: subscribeTo, lists_ToUnsubscribe: unsubscribeFrom}),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}, ${await response.text()}`)
  }

  return await response.json()
}
export async function updateSmooveContactWithRecurringPayment(
  email: string,
  accountId: string,
  recurringPaymentId: string,
  recurringPaymentStartDate: Date,
): Promise<'blacklisted' | 'not-exists' | unknown> {
  const url = new URL(`Contacts/${encodeURIComponent(email)}?by=Email`, SMOOVE_API_URL)
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SMOOVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      customFields: {
        i12: recurringPaymentId,
        i13: parseInt(accountId),
        i14: recurringPaymentStartDate.toISOString(),
      },
    }),
  })

  if (!response.ok) {
    const responseBody = await response.text()
    if (responseBody.includes('ErrBlackListed')) {
      return 'blacklisted'
    } else if (responseBody.includes('ErrExists')) {
      return 'not-exists'
    }
    throw new Error(`Failed to fetch ${url}: ${response.status}, ${responseBody}`)
  }

  return await response.json()
}

function maybeIsoToDate(iso: string): Date {
  if (iso.endsWith('z') || iso.endsWith('Z') || iso.includes('+')) {
    return new Date(iso)
  } else {
    return new Date(iso + '+02:00')
  }
}
