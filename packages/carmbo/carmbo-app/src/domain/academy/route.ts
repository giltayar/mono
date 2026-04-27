import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import {z} from 'zod'
import {dealWithControllerResult} from '../../commons/routes-commons.ts'
import {showAcademyCourseDatalist, showAcademyCoursesDatalist} from './controller.ts'
import {OngoingProductSchema} from '../product/view/model.ts'

export default function (app: FastifyInstance) {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get(
    '/query/:subdomain/datalist',
    {
      schema: {
        params: z.object({subdomain: z.string().min(1)}),
        querystring: z.object({q: z.string().optional()}),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showAcademyCourseDatalist(request.params.subdomain, request.query.q),
      ),
  )

  appWithTypes.post(
    '/courses-datalist',
    {
      schema: {
        body: OngoingProductSchema.extend({index: z.coerce.number().int().min(0)}),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showAcademyCoursesDatalist(
          request.body.academyCourses![request.body.index],
          request.body.index,
        ),
      ),
  )
}
