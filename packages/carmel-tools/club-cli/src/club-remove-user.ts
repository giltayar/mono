import {parseArgs} from 'node:util'
import * as clubs from './clubs/clubs.ts'
import {createClubServiceFromClub} from './create-club-service.ts'

// Parse command line arguments
const {values} = parseArgs({
  options: {
    help: {type: 'boolean'},
    email: {type: 'string'},
  },
})

// Show help if requested or no email provided
if (values.help || !values.email) {
  console.log(`
Usage: remove-user [options] <email>

Remove a user from the club service.

Options:
  -e, --email <email>  Email of the user to remove
  -h, --help           Show this help message

Examples:
  remove-user --email user@example.com
`)
  process.exit(1)
}

// Get email from either --email option or positional argument
const email = values.email

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(email)) {
  console.error('Error: Invalid email format')
  process.exit(1)
}

const clubService = createClubServiceFromClub(clubs['inspiredLivingDaily'])

await clubService.removeUser(email)
