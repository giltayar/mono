import process from 'node:process'
import * as z from 'zod'
import {makeApp} from './monnaie-app.ts'
import {prepareDatabase} from './prepare-database.ts'

const EnvironmentVariablesSchema = z.object({
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3000),
  DB_CONNECTION_STRING: z.string().default('postgres://user:password@localhost:5432/monnaie'),
})

const env = EnvironmentVariablesSchema.parse(process.env)

const {app, db} = makeApp({connectionString: env.DB_CONNECTION_STRING})

await prepareDatabase(db)

await app.listen({port: env.PORT, host: env.HOST})
