import {createClubServiceFromClub} from './create-club-service.ts'
import * as clubs from './clubs/clubs.ts'
import type {Clubs} from './clubs/club-types.ts'
import pino from 'pino'

const cronBatch = crypto.randomUUID()

const mainLogger = pino({level: process.env.LOG_LEVEL || 'info'})

mainLogger.info({cronBatch}, 'start-clubs-cron')

for (const club of Object.keys(clubs) as Clubs[]) {
  const logger = mainLogger.child({
    club,
    cronBatch,
    clubBatch: crypto.randomUUID(),
  })
  logger.info('start-club-batch')

  await doOperation('send-daily-whatsapp-message', 'sendDailyWhatsAppMessage', club, logger)
  await doOperation('cancel-requests', 'dealWithCancelRequests', club, logger)
  await doOperation('users-with-debt', 'dealWithUsersWithDebt', club, logger)
  await doOperation('payment-expiration', 'paymentExpiration', club, logger)
}

async function doOperation(
  name: string,
  functionName: Exclude<
    keyof Awaited<ReturnType<typeof createClubServiceFromClub>>,
    'removeUser' | 'sendMessageToClub'
  >,
  club: Clubs,
  logger: pino.Logger,
) {
  const operationLogger = logger.child({
    club,
    operationBatch: crypto.randomUUID(),
    operation: functionName,
  })

  operationLogger.info(`start-${name}`)

  const clubService = await createClubServiceFromClub(clubs[club], operationLogger)
  const func = clubService[functionName]

  await func().then(
    () => logger.info(`end-${name}`),
    (err) => logger.error({err}, `end-${name}`),
  )
}
