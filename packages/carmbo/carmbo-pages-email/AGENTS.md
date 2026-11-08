# carmbo-pages-email instructions

The TypeScript dependency aliases are deliberate: `@typescript/native` provides the TypeScript 7
`tsc` binary used for builds and type-checking, while `typescript` resolves to TypeScript 6 so
typescript-eslint can load the compiler API version it supports. Do not replace either alias with a
plain `typescript` dependency, and do not reintroduce `tsgo` or `@typescript/native-preview`.

## Domain independence

- This package owns generic email infrastructure only. It must never import domain packages (such
  as `@giltayar/carmbo-pages-community`); domains depend on it, not the other way around.
- Domain-specific email content (templates, locale strings) and outcome handling live in the
  domain package. Domains call `queueEmail` and register an `EmailResultHandler` for their purpose.
- The `sendEmail` job payload is the caller's opaque payload. Keep it that way: jobs persisted by
  earlier versions must keep working. The result handler is chosen from the purpose saved on the
  `email` row, not from the payload.
- Idempotency keys are `<purpose>/<carmbo_email_id>`. Do not change the format: retries of jobs
  created by earlier versions must reuse their original keys.
- The list/detail query joins `community_member`, `community`, and `student` tables by SQL to show
  member links. That is schema-level coupling only; tests seed those rows with raw SQL
  (`test/integration/common/fixture.ts`) instead of depending on the community/student packages.
- `EmailPurpose` mirrors the `email.purpose` CHECK constraint in `carmbo-commons` migrations; add a
  migration there before adding a purpose.
