import fastify, {type FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'

export async function createFakeFirebaseApp(): Promise<{
  app: FastifyInstance
  signInWithPasswordUrl: URL
}> {
  const app = fastify()
  app.post('/v1/accounts:signInWithPassword', async (request, reply) => {
    const {key} = request.query as {key?: string}
    const {email, password, returnSecureToken} = request.body as {
      email: string
      password: string
      returnSecureToken: boolean
    }
    if (
      key !== 'firebase-api-key' ||
      email !== 'user@example.com' ||
      returnSecureToken !== true ||
      password !== 'secret'
    ) {
      return reply.status(400).send({error: {message: 'INVALID_LOGIN_CREDENTIALS'}})
    }

    return {idToken: 'firebase-id-token'}
  })

  await app.listen({host: '127.0.0.1', port: 0})
  const {address, port} = app.server.address() as AddressInfo

  return {
    app,
    signInWithPasswordUrl: new URL('/v1/accounts:signInWithPassword', `http://${address}:${port}`),
  }
}
