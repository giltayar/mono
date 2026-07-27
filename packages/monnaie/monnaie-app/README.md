# monnaie-app

A mobile-first web app that tracks expenses.

## Stack

- **Fastify** for the server, with routes under `src/domain/<domain>/route.ts`
- **HTMX** for interactivity, so there is (almost) no frontend JavaScript
- **htm** + **vhtml** for server-side rendering of HTML in TypeScript
- **Firebase Authentication**, as a session cookie minted by the server
- **TypeScript**, running natively in Node.js (no transpilation)
- **Playwright** for integration tests, with page object models in `test/page-model`

## Running

```sh
pnpm build   # copies htmx into `dist`
pnpm start   # runs the app on http://localhost:3000
```

The app signs users in against a Firebase project, and will not start without one. Every variable
the app reads is prefixed `MONNAIE_`:

| Variable                           | Required | What it is                                               |
| ---------------------------------- | -------- | -------------------------------------------------------- |
| `MONNAIE_FIREBASE_API_KEY`         | yes      | The web API key. Public — the browser needs it to sign in |
| `MONNAIE_FIREBASE_SERVICE_ACCOUNT` | yes      | The contents of a service account key file. **A secret**  |
| `MONNAIE_FIREBASE_AUTH_DOMAIN`     | no       | Defaults to `<project-id>.firebaseapp.com`                |
| `MONNAIE_DB_CONNECTION_STRING`     | no       | Defaults to the local `docker compose` postgres           |
| `MONNAIE_LANGUAGE`                 | no       | The fallback language, `en` or `he`                       |
| `MONNAIE_HOST`, `MONNAIE_PORT`     | no       | Default to `localhost:3000`                               |

Users register themselves at `/register`, and Firebase sends them a confirmation email that they
must follow before they can log in. Users created by hand in the Firebase console work too — but
only once they are marked as verified, since the app refuses a session for an unconfirmed email.

In the Firebase console this needs the **Email/Password** and **Google** sign-in providers enabled,
the **Email address verification** template filled in, and the domain the app is served from listed
under **Authorized domains** (that is where the link in the email lands).

Each user gets a row in the `app_user` table — on registration, or on their first login if they were
created by hand — holding their settings as JSON. So far the only setting is the language they
picked, which is why it follows them from one browser to the next.

For development, put these in a `.env.local` file in the package root, which is git-ignored and read
on startup:

```sh
MONNAIE_FIREBASE_API_KEY=...
MONNAIE_FIREBASE_SERVICE_ACCOUNT={"project_id": "...", "client_email": "...", "private_key": "..."}
```

A real environment variable always wins over the file, and the file is never part of the docker
image.

## Testing

```sh
pnpm test    # eslint + typescript + playwright
```

The unit and integration tests need no Firebase project: the integration tests run the app against
`test/integration/services/fake-firebase-auth.ts`. The end-to-end test runs the published image,
which talks to the real Firebase, so it only runs when `MONNAIE_FIREBASE_API_KEY`,
`MONNAIE_FIREBASE_SERVICE_ACCOUNT`, `MONNAIE_FIREBASE_TEST_EMAIL` and
`MONNAIE_FIREBASE_TEST_PASSWORD` are set — and skips itself otherwise. Those, too, can live in
`.env.local`.
