import {enterWithChildLogger, exitFromChildLogger} from '@seasquared/pino-global'
import fastifyPlugin from 'fastify-plugin'

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {{logger: import('pino').Logger}} options
 * @param {(error?: Error) => void} done
 */
function registration(app, {logger}, done) {
  try {
    app.addHook('onRequest', logWithRequestIdEnterHandler(logger))
    app.addHook('onResponse', logWithRequestIdExitHandler)

    done()
  } catch (error) {
    done(error)
  }
}

export default fastifyPlugin(registration, {
  name: 'seasquared--request-id-logger-fastify-plugin',
  decorators: {
    request: ['requestId'],
  },
})

/**
 * @param {import("pino").Logger} logger
 */
function logWithRequestIdEnterHandler(logger) {
  return (
    /**
     * @param {import('fastify').FastifyRequest} req
     * @param {any} _reply
     * @param {import('fastify').HookHandlerDoneFunction} done
     */
    function logWithRequestIdEnterHandler(req, _reply, done) {
      const requestId = req.requestId

      enterWithChildLogger(logger.child({requestId}))

      done()
    }
  )
}

/**
 * @param {import('fastify').FastifyRequest} _req
 * @param {any} _reply
 * @param {import('fastify').HookHandlerDoneFunction} done
 */
function logWithRequestIdExitHandler(_req, _reply, done) {
  exitFromChildLogger(done)
}
