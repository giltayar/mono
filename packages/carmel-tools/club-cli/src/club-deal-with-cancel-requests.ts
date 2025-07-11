import {createClubServiceFromClub} from './create-club-service.ts'
import * as clubs from './clubs.ts'

const clubService = createClubServiceFromClub(clubs['hakavodHakvanti'])

await clubService.dealWithCancelRequests()
