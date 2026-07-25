# Monorepo instructions

## Monorepo structure

- All folders in this repo under the `packages` folders are self-contained packages
- They are organized in groups. The directory structure is `packages/<group>/<package>`
- Each package is self-contained and should be built and published separately from the others
- The packages do _not_ share configuration.
  Each package has their own lint/typescript/playwright/whatever configuration.

## Package independence

- This repo does _not_ use package hoisting and linking like it is done in pnpm/yarn/npm workspace.
  There are no workspaces.
- If package B depends on package A, and you want to change A to support something in B, you _cannot_
  modify A and B at the same time and assume that B "sees" the changes in A.
  - What you should do is change A, test it, publish A, then do the same for B.

## Package structure

- To edit a package, just edit the files
- All packages in this repo are npm packages, and all are ESM package
- They have a `package.json` in the root of the package
- They have an `src` folder for the source code of the package
- They have a `test` folder for the tests of the package
- If they generate code from `src`, it is always in a `dist` folder

## Package lifecycle

- All packages use pnpm
- To install, use `pnpm install`
- To publish a change in a package, you:
  - Edit the source code
  - Write the tests
  - Then build the package
  - Then test what you wrote using the tests (or manually if you cannot write a test)
  - Continue iterating till the tests pass
  - Publish the package
- Note that you can never

## Building a package

- To build a package, run `pnpm build`
- What it does is run all `build:*` scripts in the `package.json`

## Testing a package

- To test a package, run `pnpm test`
- Most of the times, you need to build the package before running the tests
- What it does is run all the `test:*` scripts in the `package.json`
- Sometimes we want to run a specific test file and not all of them:
  - To do that, use the specific `test:*` script
  - For example, for a specific playwright test, use `pnpm test:playwright <specific-test-file>`
  - Or to run all playwright tests, just use `pnpm test:playwright`
  - The same is for Node tests - `pnpm test:node` or `pnpm test:node <specific-test-file>`

## Publishing a package

- To publish a package, run`pnpm publish`

## Language, runtime, and module system

- Every package is written in **TypeScript** and is a native **ESM** package (`"type": "module"`).
- Target the Node.js version declared in each package's `engines` field (currently `>=24.0.0`). Use
  modern Node built-ins and the `node:` import prefix for them (e.g. `import test from 'node:test'`).
- Type-checking and building use `tsgo` (the `@typescript/native-preview` compiler), _not_ `tsc`.
  Do not assume plain `tsc` behavior or add `tsc` to scripts.

## TypeScript conventions

- The build tsconfig enables `strict`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`. Because of
  `erasableSyntaxOnly`, do **not** use TypeScript constructs that emit runtime code — no `enum`,
  no parameter properties, no runtime `namespace`. Prefer plain types, `const` objects, and unions.
- `verbatimModuleSyntax` is on, so use `import type {...}` / `export type {...}` for type-only
  imports and exports.
- **Imports keep their `.ts` extension** in both `src` and `test` (the config uses
  `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`). Import local modules as
  `'../../src/functional-commons.ts'`, and the compiler rewrites the extension for the built output.
- Give exported functions explicit return types. Export named functions/values; avoid default exports.

## Code style (Prettier)

- Formatting is enforced by Prettier via ESLint (`prettier/prettier` runs as a warning, and
  `test:eslint` runs with `--max-warnings=0`, so warnings fail the build). Match the existing
  `.prettierrc` in each package:
  - No semicolons
  - Single quotes
  - Trailing commas everywhere (`"all"`)
  - No bracket spacing (`{foo}`, not `{ foo }`)
  - Print width 100
- Do not hand-format against these rules; write code that already matches so lint passes.

## Linting

- ESLint runs over `src/**` and `test/**`. Key rules to respect:
  - Unused variables are warnings unless prefixed with `_` (`argsIgnorePattern`/`varsIgnorePattern`
    is `^_`). Prefix intentionally-unused args/vars with `_`.
  - `no-warning-comments` flags `fixme`, `removeme`, `xxx`, `@@@` — do not leave these in code.
  - `@typescript-eslint/no-explicit-any` is off, so `any` is allowed when necessary, but prefer
    precise types.
  - `eslint-plugin-n` is enabled: only use Node built-in features supported by the target engine,
    and do not import unpublished dependencies (type-only imports are exempt).

## Testing conventions

- Tests use the built-in **`node:test`** runner with **`node:assert`** (often
  `node:assert/strict`). Run them with `node --test` (via `pnpm test:node`).
- Test files live under `test/` and end in `.test.ts`. Larger packages split tests into
  `test/unit/`, `test/integ/`, and `test/e2e/` subfolders; follow the existing layout of the package
  you are editing.
- Tests import the code under test from source using the `.ts` extension
  (e.g. `import {...} from '../../src/scripting-commons.ts'`).
- Reference other packages by their published name (`@giltayar/promise-commons`), never by relative
  path across package boundaries.

## package.json conventions

- `scripts` follow a fixed pattern driven by `npm-run-all`:
  - `build` runs `run-p 'build:*'`; `build:typescript` does `rm -rf dist && tsgo --project tsconfig.build.json`.
  - `test` runs `run-p --aggregate-output 'test:*'`; typical members are `test:eslint`
    (`eslint --max-warnings=0 .`), `test:typescript` (`tsgo`), and `test:node` (`node --test`).
  - Add new checks as additional `build:*` / `test:*` scripts so they are picked up automatically.
- `exports` map the public entry to the built output in `dist` (`types` -> `./dist/src/*.d.ts`,
  `import` -> `./dist/src/*.js`). The `files` array publishes `src` and `dist`.
- Cross-package dependencies are on published `@giltayar/*` versions in `dependencies` /
  `devDependencies`, consistent with the "no workspaces / package independence" rules above.
