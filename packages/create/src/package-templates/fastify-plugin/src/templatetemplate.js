import fastifyPlugin from 'fastify-plugin'

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {{decoratorText: string, targetStatus: number}} options
 * @param {(error?: Error) => void} done
 */
function registration(app, {decoratorText, targetStatus}, done) {
  try {
    // add decorators and hooks
    app.decorateRequest('decorated', decoratorText)
    app.addHook('onSend', sendHandler(targetStatus))

    done()
  } catch (error) {
    done(error)
  }
}

export default fastifyPlugin(registration, {
  name: 'seasquared--templatetemplate',
})

/**
 *
 * @param {number} targetStatus
 */
function sendHandler(targetStatus) {
  return (
    /**
     * @param {import('fastify').FastifyRequest} _req
     * @param {import('fastify').FastifyReply} reply
     * @param {any} payload
     * @param {any} done
     */
    function (_req, reply, payload, done) {
      try {
        if (reply.statusCode === 418) {
          reply.code(targetStatus)
        }

        done(null, payload)
      } catch (err) {
        done(err)
      }
    }
  )
}
