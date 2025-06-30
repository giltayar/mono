import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import type {ClubServiceContext, ClubServiceData} from './club-service-types.ts'
import {removeUser} from './club-remove-user.ts'
import {dealWithCancelRequests} from './deal-with-cancel-requests.ts'
import {dealWithUsersWithDebt} from './deal-with-users-with-debt.ts'
import {paymentExpiration} from './club-payment-expiration.ts'
import {log} from 'console'

export type {ClubServiceContext}

export function createClubService(context: ClubServiceContext) {
  const sBind: ServiceBind<ClubServiceData> = (f) =>
    bind(f, {
      context: {
        ...context,
        services: {
          ...context.services,
          logger: context.services.logger.child({service: 'club-service'}),
        },
      },
    })

  return {
    removeUser: sBind(removeUser),
    dealWithCancelRequests: sBind(dealWithCancelRequests),
    dealWithUsersWithDebt: sBind(dealWithUsersWithDebt),
    paymentExpiration: sBind(paymentExpiration),
  }
}
