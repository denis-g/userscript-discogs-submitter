import antfu from '@antfu/eslint-config';
import globals from 'globals';

export default antfu(
  {
    ignores: [
      'node_modules/*',
      'discogs-submitter.user.js',
    ],
    stylistic: {
      indent: 2,
      semi: true,
      overrides: {
        'style/max-len': ['off'],
      },
    },
    formatters: {
      css: true,
      prettierOptions: {
        printWidth: 120,
        plugins: ['prettier-plugin-css-order'],
        overrides: [{
          files: ['src/**/*.css'],
          options: {
            cssDeclarationSorterOrder: 'frakto',
            cssDeclarationSorterKeepOverrides: false,
          },
        }],
      },
    },
    jsonc: true,
    markdown: true,
    typescript: true,
    jsx: false,
    vue: false,
    yaml: false,
    toml: false,
    angular: false,
  },
  {
    files: [
      'src/**/*.{js,ts}',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...globals.greasemonkey,
        ...globals.node,
      },
    },
    rules: {
      // Increase max-len to 999 for code and 120 for comments
      'style/max-len': [
        'error',
        { code: 999, comments: 120 },
      ],
      // Disable prefer-static-regex
      'e18e/prefer-static-regex': 'off',
      // Always use curly braces for all control flow statements
      'curly': ['error', 'all'],
      // Always use consistent spacing around statements
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: ['class', 'const', 'export', 'import', 'let', 'var'] },
        { blankLine: 'always', prev: ['class', 'const', 'export', 'import', 'let', 'var'], next: '*' },
        { blankLine: 'never', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
        { blankLine: 'any', prev: ['export', 'import'], next: ['export', 'import'] },
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
    },
  },
);
