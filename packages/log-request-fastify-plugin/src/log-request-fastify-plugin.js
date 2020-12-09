import assert from 'assert'
import fastifyPlugin from 'fastify-plugin'

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {{logger: import('pino').Logger}} options
 * @param {(error?: Error) => void} done
 */
function logRequestFastifyPlugin(app, {logger}, done) {
  assert(logger != null, 'logger must not be null')
  try {
    app.decorateRequest('error', false)
    app.addHook('onError', logErrorHandler)
    app.addHook('onResponse', logResponseHandler(logger))

    done()
  } catch (error) {
    done(error)
  }
}

export default fastifyPlugin(logRequestFastifyPlugin, {
  name: 'seasquared--log-request-fastify-plugin',
})

/**
 * @param {import('fastify').FastifyRequest} req
 * @param {import('fastify').FastifyReply} _reply
 * @param {Error} error
 * @param {import('fastify').HookHandlerDoneFunction} done
 */
function logErrorHandler(req, _reply, error, done) {
  try {
    req.error = error

    done()
  } catch (error) {
    done(error)
  }
}

/**
 * @param {import("pino").Logger} logger
 */
function logResponseHandler(logger) {
  return (
    /**
     * @param {import('fastify').FastifyRequest} req
     * @param {import('fastify').FastifyReply} reply
     * @param {import('fastify').HookHandlerDoneFunction} done
     */
    function logResponseHandler(req, reply, done) {
      try {
        const statusCode = reply.statusCode
        const error = req.error

        logger.info({
          event: 'request-handled',
          statusCode: reply.statusCode,
          method: req.method,
          url: req.url,
          error: error != null ? error.stack || String(error) : undefined,
          success: statusCode < 500,
        })

        done()
      } catch (err) {
        done(err)
      }
    }
  )
}
