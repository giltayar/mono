import prettier from 'eslint-plugin-prettier'
import n from 'eslint-plugin-n'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config([
  {
    files: ['src/**/*.[jt]s', 'test/**/*.[jt]s'],
    ignores: ['./.db-data/'],
    plugins: {prettier, n},
    extends: [n.configs['flat/recommended'], ...tseslint.configs.recommended],
    languageOptions: {
      globals: {...globals.commonjs, ...globals.node, ...globals.browser},
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'prettier/prettier': ['warn'],
      'no-warning-comments': [
        'warn',
        {terms: ['fixme', 'removeme', 'xxx', '@@@'], location: 'anywhere'},
      ],
      'no-process-exit': 'off',
      'no-const-assign': 'error',
      'no-this-before-super': 'error',
      'no-undef': 'warn',
      'no-unreachable': 'warn',
      'constructor-super': 'warn',
      'valid-typeof': 'warn',
      'n/exports-style': ['error', 'module.exports'],
      'n/no-unpublished-import': ['error', {ignoreTypeImport: true}],
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {varsIgnorePattern: '^_', args: 'all', argsIgnorePattern: '^_'},
      ],
      'n/no-unsupported-features/node-builtins': [
        'error',
        {ignores: ['assert.partialDeepStrictEqual']},
      ],
    },
  },
])
