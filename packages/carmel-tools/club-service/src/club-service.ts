import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import type {ClubService, ClubServiceData} from './club-service-types.ts'
import {removeUser} from './club-remove-user.ts'
import {dealWithCancelRequests} from './deal-with-cancel-requests.ts'
import {dealWithUsersWithDebt} from './deal-with-users-with-debt.ts'
import {paymentExpiration} from './club-payment-expiration.ts'

export type {ClubService}

export function createClubService(context: ClubService.Context) {
  const sBind: ServiceBind<ClubServiceData> = (f) => bind(f, {context})

  return {
    removeUser: sBind(removeUser),
    dealWithCancelRequests: sBind(dealWithCancelRequests),
    dealWithUsersWithDebt: sBind(dealWithUsersWithDebt),
    paymentExpiration: sBind(paymentExpiration),
  }
}
