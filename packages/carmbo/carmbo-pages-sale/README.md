# `@giltayar/carmbo-pages-sale`

Product, sales-event, sale, and supporting external-provider pages for Carmbo applications.

## Local start

Start the package's PostgreSQL service and local Fastify host:

```bash
pnpm start
```

Open <http://127.0.0.1:3001/sales>. Data persists until the Docker Compose service is removed. The
start lifecycle refreshes Bootstrap and HTMX assets under `start/dist` before serving them.

Stop and remove the local PostgreSQL service:

```bash
pnpm stop
```

Use `LANGUAGE=he pnpm start` for Hebrew/Liraz rendering. The Fastify and PostgreSQL ports are fixed
at `3001` and `5434`, respectively.
