import {createClubServiceFromClub} from './create-club-service.ts'
import * as clubs from './clubs/clubs.ts'
import yargs from 'yargs'
import type {Clubs} from './clubs/club-types.ts'

const args = yargs()
  .scriptName('handle-debt')
  .option('club', {
    type: 'string',
    choices: Object.keys(clubs) as Clubs[],
    demandOption: true,
  })
  .strict()
  .help()
  .parseSync(process.argv.slice(2))

const clubService = createClubServiceFromClub(clubs[args.club])

clubService.dealWithUsersWithDebt()
