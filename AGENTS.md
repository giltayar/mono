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
