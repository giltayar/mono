import fastifyPlugin from 'fastify-plugin'
import {v4 as uuid} from 'uuid'

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {{}} _options
 * @param {(error?: Error) => void} done
 */
function registration(app, _options, done) {
  try {
    app.decorateRequest('requestId', '')
    app.addHook('onRequest', setRequestIdHandler)

    done()
  } catch (error) {
    done(error)
  }
}

export default fastifyPlugin(registration, {
  name: 'seasquared--request-id-fastify-plugin',
})

/**
 * @param {import('fastify').FastifyRequest} req
 * @param {any} _reply
 * @param {import('fastify').HookHandlerDoneFunction} done
 */
function setRequestIdHandler(req, _reply, done) {
  const requestId = /**@type{string}*/ (req.headers['x-request-id'] ?? uuid())

  req.requestId = requestId

  done()
}
