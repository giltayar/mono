import {createApp} from './app.ts'
import {createFakes} from './fakes.ts'
import {initializePostgres} from './postgres.ts'

const host = '127.0.0.1'
const port = 3000

const database = await initializePostgres()
const app = await createApp(database, createFakes())
await app.listen({host, port})
app.log.info(`Student pages are available at http://${host}:${port}/students`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close()
    await database.end()
  })
}
