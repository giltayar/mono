import prettier from 'eslint-plugin-prettier'
import n from 'eslint-plugin-n'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config([
  {
    ignores: ['dist/**', '.nx/**'],
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    plugins: {prettier, n},
    extends: [n.configs['flat/recommended'], ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
    rules: {
      'prettier/prettier': 'warn',
      'no-warning-comments': [
        'warn',
        {terms: ['fixme', 'removeme', 'xxx', '@@@'], location: 'anywhere'},
      ],
      'n/no-unpublished-import': ['error', {ignoreTypeImport: true}],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {varsIgnorePattern: '^_', args: 'all', argsIgnorePattern: '^_'},
      ],
    },
  },
])
