import process from 'node:process'
import * as z from 'zod'
import {makeApp} from './monnaie-app.ts'

const EnvironmentVariablesSchema = z.object({
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3000),
})

const env = EnvironmentVariablesSchema.parse(process.env)

const app = makeApp()

await app.listen({port: env.PORT, host: env.HOST})
