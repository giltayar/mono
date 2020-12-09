import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    // add decorated properties here
    decorated: string
  }
}