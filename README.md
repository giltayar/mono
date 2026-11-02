# mono

## Nx workflows (Carmbo)

The repository-local [@giltayar/nx-btp package](./packages/commons/nx-btp/README.md) owns the workflow
implementation and configuration. The root only hosts Nx and forwards build/test commands.
Packages remain independently managed; there are no package-manager workspaces or links.

Install the root host and plugin independently:

```sh
pnpm install
pnpm --dir packages/commons/nx-btp install
```

From the repository root:

```sh
nx start-btp carmbo-pages-auth
nx btp carmbo-pages-auth --dry-run
nx btp carmbo-pages-auth --msg='fix login redirect'
```

**The `btp` (build-test-publish) command really publishes, commits, tags, and pushes**, but it skips packages that
are unchanged since their last release. See the
[workflow documentation](./packages/commons/nx-btp/README.md) for change detection, version
selection, commit prefixes, `NO_TESTS`, and staging safeguards.

Validate the plugin from the root with `pnpm build` and `pnpm test`, or run those commands directly
in `packages/commons/nx-btp`.
