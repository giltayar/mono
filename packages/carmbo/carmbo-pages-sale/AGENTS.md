# carmbo-pages-sale instructions

The TypeScript dependency aliases are deliberate: `@typescript/native` provides the TypeScript 7
`tsc` binary used for builds and type-checking, while `typescript` resolves to TypeScript 6 so
typescript-eslint can load the compiler API version it supports. Do not replace either alias with a
plain `typescript` dependency, and do not reintroduce `tsgo` or `@typescript/native-preview`.
