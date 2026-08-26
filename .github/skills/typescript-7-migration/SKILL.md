---
name: typescript-7-migration
description: Migrate a package to TypeScript 7 (the native compiler) while keeping typescript-eslint working, which still requires TypeScript 6. Use when the user wants to move a package off tsgo/@typescript/native-preview, adopt TypeScript 7, upgrade a package's TypeScript version, or when typescript-eslint breaks after a TypeScript 7 upgrade with errors about an unsupported or missing TypeScript version.
---

# Migrating a package to TypeScript 7

## The problem

TypeScript 7 (the Go-based native compiler) ships as `typescript@7`. **typescript-eslint does not
support it** — it loads the compiler with `require('typescript')` and needs the TypeScript 6 API.

So one package name, `typescript`, has to mean two different things at once: TS 7 for
type-checking, TS 6 for linting. Installing them normally is impossible; the fix is a pair of npm
aliases, arranged so that the name `typescript` resolves to **6** and the binary `tsc` is **7**.

## The recipe

### 1. Swap the dependencies

In `devDependencies`, remove any `typescript`, `tsgo` or `@typescript/native-preview` entry and put
in exactly these two lines:

```jsonc
{
  "devDependencies": {
    // the real TypeScript 7; the only thing that provides the `tsc` binary
    "@typescript/native": "npm:typescript@^7.0.2",
    // TypeScript 6 under the name every tool resolves by `require('typescript')`.
    // Its binary is `tsc6`, so it does not collide with the one above.
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

The aliases look backwards, and that is the point:

| `package.json` name  | resolves to               | binary | who uses it        |
| -------------------- | ------------------------- | ------ | ------------------ |
| `@typescript/native` | `typescript@7`            | `tsc`  | `tsc`, the build   |
| `typescript`         | `@typescript/typescript6` | `tsc6` | typescript-eslint  |

Because the two packages deliberately use **different bin names**, there is no `.bin` conflict and
nothing to disambiguate.

### 2. Point the scripts at `tsc`

```jsonc
{
  "scripts": {
    "test:typescript": "tsc",
    "build:typescript": "rm -rf dist && tsc --project tsconfig.build.json"
  }
}
```

Anything that said `tsgo` now says `tsc`. Never write `tsc6` in a script — it exists only so that
typescript-eslint has a compiler, and type-checking with it would silently check against the old
version.

### 3. Let pnpm install them

Every package has its own `pnpm-workspace.yaml`. If it sets `minimumReleaseAge`, pnpm refuses
recently published versions and the install stops on a prompt. Add the scope to the exclude list
rather than approving the prompt:

```yaml
minimumReleaseAge: 1440 # 1 day
minimumReleaseAgeExclude:
  - '@typescript/*'
```

Then `pnpm install` **in that package's directory** — there are no workspaces here, so installs are
per-package.

### 4. Verify — all four, in this order

```bash
npx tsc --version      # must print 7.x
npx tsc6 --version     # must print 6.x
pnpm test:typescript   # TS 7 type-checks the package
pnpm test:eslint       # typescript-eslint parses via TS 6
```

`pnpm test:eslint` is the one that actually proves the migration: if the aliases were wrong,
typescript-eslint is the thing that breaks, not the compiler. Finish by running the package's real
test suites, since a compiler swap should change nothing at runtime.

## What does **not** need changing

- **`tsconfig.json`** — TS 7 reads the same options. `strict`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly`, `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`,
  `module: nodenext` all carry over untouched. Do not rewrite the config "for TS 7".
- **`eslint.config.mjs`** — typescript-eslint needs no new setting; it just needs `require('typescript')`
  to find version 6, which the alias arranges.
- **Source code** — this is a toolchain change, not a language change.

## Gotchas

- ⚠️ **Do not "tidy" the aliases.** They read like a mistake, and the next person to touch
  `package.json` will want to replace `"typescript": "npm:@typescript/typescript6@..."` with a plain
  `"typescript": "^7"`. Leave a comment in the package's `AGENTS.md`/README saying the swap is
  deliberate.
- ⚠️ **Never add a plain `typescript` dependency alongside these.** It would take the name back and
  break linting.
- Check that `node_modules/typescript/lib/typescript.js` exists after installing — that file, from
  the TS 6 alias, is precisely what typescript-eslint loads.
- `@typescript/native` ships a platform-specific native binary, so lockfiles gain entries per
  platform. That is expected.
- The editor's TypeScript server still comes from whatever `typescript` resolves to, i.e. **TS 6**.
  Diagnostics in VS Code can therefore differ slightly from what `pnpm test:typescript` reports;
  the script is the source of truth.
- If the repo forbids running compilers directly (many do, so that flags come from the script),
  use `pnpm test:typescript` rather than a bare `tsc` when checking your work.

## Doing several packages

Packages are migrated **one at a time**, each with its own install and its own verification — this
repo has no workspace hoisting and no linking, so one package's `node_modules` says nothing about
another's. Migrate, verify all four commands, run the package's own tests, commit, then move on.

Worked examples to copy from, in increasing order of complexity:
`packages/commons/http-commons`, `packages/carmel-tools/ravmesser-integration` (has a
`tsconfig.build.json` and therefore a `build:typescript` script), and
`packages/monnaie/monnaie-app` (no build step — it runs from `src/` via Node's native TypeScript —
and has a `minimumReleaseAge` that had to be excluded).

Still on `tsgo` at the time of writing:

```
carmbo/carmbo-app
carmel-tools/{academy,cardcom,google-sheets,skool,whatsapp}-integration
carmel-tools/{club-cli,club-service,clubs-cron}
commons/{console-tesktit,dependencies-commons,docker-compose-testkit,functional-commons}
commons/{node-test-commons,pino-testkit,promise-commons,scripting-commons}
commons/{service-commons,url-commons}
```

Re-derive that list rather than trusting it:

```bash
grep -l '"tsgo"\|native-preview' packages/*/*/package.json   # still to do
grep -l '@typescript/native"' packages/*/*/package.json      # already migrated
```

Finally, each package documents its own conventions in `AGENTS.md`. If the one you migrate mentions
`tsgo`, update it — and say there that the aliases are deliberate, so nobody "fixes" them later.
