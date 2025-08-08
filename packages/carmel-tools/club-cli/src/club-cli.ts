import {
  createClubServiceFromClub,
  createSmooveIntegrationService,
  createWhatsAppIntegrationService,
} from './create-club-service.ts'
import * as clubs from './clubs/clubs.ts'
import yargs from 'yargs'
import type {Clubs} from './clubs/club-types.ts'
import {
  removeLeavingFromWhatsappGroup,
  syncWhatsappGroupWithClub,
  transferFromClubToLeaving,
} from './one-offs/transfer-leaving.ts'

await yargs()
  .option('club', {
    type: 'string',
    choices: Object.keys(clubs) as Clubs[],
    demandOption: true,
  })
  .command(
    'expire-subscriptions',
    'Expire subscriptions for a club',
    () => {},
    async (args) => {
      const clubService = await createClubServiceFromClub(clubs[args.club])

      await clubService.paymentExpiration()
    },
  )
  .command(
    'handle-cancel-requests',
    'Handle cancel requests for a club',
    () => {},
    async (args) => {
      const clubService = await createClubServiceFromClub(clubs[args.club])

      await clubService.dealWithCancelRequests()
    },
  )
  .command(
    'handle-debt',
    'Handle users with debt for a club',
    () => {},
    async (args) => {
      const clubService = await createClubServiceFromClub(clubs[args.club])

      await clubService.dealWithUsersWithDebt()
    },
  )
  .command(
    'remove-user <user-email>',
    'Remove a user from a club',
    (yargs) =>
      yargs.positional('user-email', {
        type: 'string',
        demandOption: true,
        describe: 'Email of the user to remove',
      }),
    async (args) => {
      const clubService = await createClubServiceFromClub(clubs[args.club])

      await clubService.removeUser(args['user-email'])
    },
  )
  .command(
    'send-message <message>',
    'Send a message to the WhatsApp group of a club',
    (yargs) =>
      yargs.positional('message', {
        type: 'string',
        demandOption: true,
        describe: 'Message to send to the club WhatsApp group',
      }),
    async (args) => {
      const clubService = await createClubServiceFromClub(clubs[args.club])

      await clubService.sendMessageToClub(args.message)
    },
  )
  .command(
    'send-daily-whatsapp-message',
    'Send daily WhatsApp message to the club group',
    () => {},
    async (args) => {
      const clubService = await createClubServiceFromClub(clubs[args.club])

      await clubService.sendDailyWhatsAppMessage()
    },
  )
  .command(
    'one-off-transfer-leaving',
    'Transfer users from club to leaving group',
    () => {},
    async (args) => {
      const smoove = await createSmooveIntegrationService(clubs[args.club])

      await transferFromClubToLeaving(smoove)
    },
  )
  .command(
    'one-off-remove-leaving-from-whatsapp-group',
    'Remove users from the WhatsApp group of the leaving group',
    () => {},
    async (args) => {
      const smoove = await createSmooveIntegrationService(clubs[args.club])
      const whatsapp = await createWhatsAppIntegrationService()

      await removeLeavingFromWhatsappGroup(smoove, whatsapp)
    },
  )
  .command(
    'one-off-sync-whatsapp-group-with-club',
    'Sync the WhatsApp group with the club members',
    () => {},
    async (args) => {
      const smoove = await createSmooveIntegrationService(clubs[args.club])
      const whatsapp = await createWhatsAppIntegrationService()

      await syncWhatsappGroupWithClub(smoove, whatsapp, clubs[args.club])
    },
  )
  .strict()
  .help()
  .parseAsync(process.argv.slice(2))
