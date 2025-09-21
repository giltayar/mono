import fastify from 'fastify'

export function makeApp() {
  const app = fastify()

  app.get('/students')

  app.get('/health', async () => {
    return {status: 'ok'}
  })

  return app
}
