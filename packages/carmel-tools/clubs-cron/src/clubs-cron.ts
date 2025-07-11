import {createClubServiceFromClub} from './create-club-service.ts'
import * as clubs from './clubs/clubs.ts'
import type {Clubs} from './clubs/club-types.ts'
import {pino} from 'pino'

const cronBatch = crypto.randomUUID()

for (const club of Object.keys(clubs) as Clubs[]) {
  const logger = pino({level: process.env.LOG_LEVEL || 'info'}).child({
    club,
    cronBatch,
    clubBatch: crypto.randomUUID(),
  })
  logger.info({event: 'start-club-batch'})

  await doOperation('payment-expiration', 'paymentExpiration', club, logger)
  await doOperation('cancel-requests', 'dealWithCancelRequests', club, logger)
  await doOperation('users-with-debt', 'dealWithUsersWithDebt', club, logger)
}

async function doOperation(
  name: string,
  functionName: Exclude<keyof ReturnType<typeof createClubServiceFromClub>, 'removeUser'>,
  club: Clubs,
  logger: pino.Logger,
) {
  const operationLogger = logger.child({
    club,
    operationBatch: crypto.randomUUID(),
    operation: functionName,
  })

  operationLogger.info({event: `start-${name}`})

  const clubService = createClubServiceFromClub(clubs[club], operationLogger)
  const func = clubService[functionName]

  await func().then(
    () => logger.info({event: `end-${name}`}),
    (err) => logger.error(err, {event: `end-${name}`}),
  )
}
