# carmbo-pages-community instructions

The TypeScript dependency aliases are deliberate: `@typescript/native` provides the TypeScript 7
`tsc` binary used for builds and type-checking, while `typescript` resolves to TypeScript 6 so
typescript-eslint can load the compiler API version it supports. Do not replace either alias with a
plain `typescript` dependency, and do not reintroduce `tsgo` or `@typescript/native-preview`.

## View schema vs. model schema

Keep the two community schemas separate:

- The view schema (`src/view/model.ts`, `CommunityViewSchema`) is what the UI sends and what views
  render. It has no id, every field is a string, and it does no validation. Views only import
  types from `src/view/model.ts`, never from `src/model.ts`.
- The model schema (`src/model.ts`, `CommunitySchema`/`NewCommunitySchema`) has the
  `communityNumber` id, real types, and all validation. Model functions validate their input with
  it.
- `src/view-model-mapping.ts` converts between them (type conversion only, no validation), and the
  controller is the only place that uses it. The id always comes from the URL, never the form.
