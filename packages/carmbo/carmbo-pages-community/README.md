# `@giltayar/carmbo-pages-community`

Community pages for Carmbo applications: a searchable, paged community list and pages to create,
update, archive, restore, and view the history of a community.

## Usage

The host must initialize i18next, the app version, and the UI configuration, register
`@fastify/formbody`, `@fastify/request-context`, the Zod validator/serializer compilers, and run
the `@giltayar/carmbo-commons` migrations. Then mount the routes:

```ts
import {routes as communityRoutes} from '@giltayar/carmbo-pages-community/routes'

app.register(communityRoutes, {prefix: '/communities', sql, nowService: () => new Date()})
```

Call `setUiConfiguration(name, {withCommunities: true})` to show the Communities navigation item.
Page models for browser tests are exported from `@giltayar/carmbo-pages-community/testkit/page-model/*`.

## Local start

Start the package's PostgreSQL service and local Fastify host:

```bash
pnpm start
```

Open <http://127.0.0.1:3000/communities>. Data persists until the Docker Compose service is removed.
The start lifecycle refreshes Bootstrap and HTMX assets under `start/dist` before serving them.

Stop and remove the local PostgreSQL service:

```bash
pnpm stop
```

Use `LANGUAGE=he pnpm start` for Hebrew/Liraz rendering. The Fastify and PostgreSQL ports are fixed
at `3000` and `5435`, respectively.
