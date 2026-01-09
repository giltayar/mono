# carmbo-app instructions

## General

- `carmbo-app` is a web app that is a CRM for a person (carmel egger) that does online courses.

- It stores students, products, sales events, and sales

- It integrates with
  - Smoove, for mailing lists
  - The Israeli Academy, for the course content itself
  - Cardcom, for billing
  - Whatsapp, for community groups

## Architecture

- `carmbo-app` is a web app that uses HTMX for the web pages and interactivity, so there is very little
  frontend javascript.

- For server-side rendering of the HTML, it uses the `htm` and `vhtml` package

- It uses TypeScript natively in Node.js without the need to transpile

- For CSS and components, it uses bootstrap.

- What little JS there is can be found in the `src` folder, and the HTML references it directly there.

- It uses postgres as the backend database

- It is deployed to Railway via a docker image, and uses Neon as the cloud postgres server

- The entry point to the app is in `src/app/index.ts`. This file:
  1. Reads the environment variables
  1. Creates the postgres db client
  1. Creates the various services used by the app
  1. Passes the db client and services to `src/app/carmbo-app.ts` to create the Fastify app
  1. Makes the fastify app listen to the host/port.

- This means that the app itself, minus the initializations, can be found in `src/app/carmbo-app.ts`.

- The `carmbo-app.ts` creates the various routes to the students page, products page, sales event page,
  and sales page, and the various api routes need by Cardcom and Smoove webhooks.

- The routes and their code can be found in the subdirectories under `src/domain`: `student`, `product`,
  `sales-event`, `sale`, `job`

- In each domain you can found the routes, controllers, views, and models for each domain.

- The routes are the fastify routes, which call the controller code. The controller calls the model code
  to either query or do something, and returns the HTML via the view code.

## Running the app

- To run the app, run `pnpm start`

- This runs `start:local:docker-compose` which runs docker compose that runs a Postgres docker image

- It also runs `start:local:app` which runs the `index.ts` app.

- The `index.ts` app assumes all environment variables for the various secrets are defined. The secrets
  are for the various services that integrate with Smoove, Cardcom, Whatsapp, and the Israeli Academy

- You can run fakes for all thes services by defining `FAKE=-fake` and what will run is `src/app/index-fake.ts`
  which uses fakes of all these services, so usually I run using `FAKE=-fake pnpm start`

## The database schema

- The database schema can be found in `src/sql`. It is a set of sql migration files and Typescript migration files,
  which the app uses to migrate the database from its current schema to the latest schema.

- The code for this can be found in `sq/migration.ts`

## The tests

- Most of the tests of the app are integration tests. These are Playwright tests

- They are found in `test/integration/<domain>/*.test.ts`

- The first thing each test file does is call `setup`:
  - It creates a docker compose project with Postgres that is specific for the test file
    (using the `docker-compose-testkit` package).
  - It runs the `src/app/carmbo-app.ts` but gives it fake services and the postgres server it created via docker

- Then the tests run against this app

- The test are standard Playwright tests, but instead of having locators in the test code itself, all locators
  can be found in `test/page-model/<domain>/*.model.ts`.
  - These files have `create*` functions that receive the Playwright `page` and define a hierarchical object
    model of the page whose nodes are functions and
    whose leaves are `.locator` properties that have the playwright locators.
