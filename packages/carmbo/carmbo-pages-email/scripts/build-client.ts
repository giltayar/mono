import {build, type Plugin} from 'esbuild'

// Browser-only replacements for modules the editor bundle does not need (see each shim).
const shims: {name: string; filter: RegExp; importer: RegExp; shim: string}[] = [
  {
    name: '@react-email/editor code-block email renderer',
    filter: /^\.\/code-block-email-[\w-]+\.mjs$/,
    importer: /[/\\]@react-email[/\\]editor[/\\]/,
    shim: 'code-block-email.ts',
  },
  {
    name: 'hast-util-from-html',
    filter: /^hast-util-from-html$/,
    importer: /[/\\]@react-email[/\\]editor[/\\]/,
    shim: 'hast-util-from-html.ts',
  },
]

const shimPlugin: Plugin = {
  name: 'browser-shims',
  setup(builder) {
    const used = new Set<string>()
    for (const {name, filter, importer, shim} of shims) {
      builder.onResolve({filter}, (args) => {
        if (!importer.test(args.importer)) return undefined
        used.add(name)
        return {
          path: new URL(`../src/templates/client/shims/${shim}`, import.meta.url).pathname,
        }
      })
    }
    builder.onEnd((result) => {
      if (result.errors.length) return
      const unused = shims.filter(({name}) => !used.has(name)).map(({name}) => name)
      // Fail loudly if a dependency update renames a target, instead of silently regrowing.
      if (unused.length) throw new Error(`Browser shims no longer match: ${unused.join(', ')}`)
    })
  },
}

await build({
  entryPoints: ['src/templates/client/editor.tsx'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  minify: true,
  target: 'es2025',
  outdir: 'dist/browser/email-template',
  plugins: [shimPlugin],
  logLevel: 'warning',
})
