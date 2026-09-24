module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:prettier/recommended',
  ],
  env: {
    node: true,
  },
  settings: {
    // eslint-import-resolver-node doesn't understand package.json "exports" maps, which
    // firebase-functions v7's v2/* subpaths rely on — the typescript resolver does.
    'import/resolver': {
      typescript: true,
    },
  },
  rules: {
    '@typescript-eslint/no-non-null-assertion': 'off',
    // False positives on firebase-admin's namespace export (conditional exports confuse this
    // rule's static analysis) — admin.initializeApp/firestore etc. are real, working exports.
    'import/namespace': 'off',
    'import/order': [
      'error',
      {
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
        pathGroupsExcludedImportTypes: ['builtin'],
      },
    ],
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': [
      'off',
      {
        allowArgumentsExplicitlyTypedAsAny: true,
      },
    ],
    '@typescript-eslint/explicit-function-return-type': 'warn',
  },
};
