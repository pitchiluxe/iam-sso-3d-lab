module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'eqeqeq': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'off',
    'no-empty': 'error',
    'no-unreachable': 'error',
  },
  ignorePatterns: ['dist', 'node_modules'],
  overrides: [
    {
      files: ['tests/**/*.ts', 'e2e/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-console': 'off',
      },
    },
  ],
};
