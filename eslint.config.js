import antfu from '@antfu/eslint-config';
import globals from 'globals';

export default antfu(
  {
    ignores: [
      'node_modules/*',
      '.agents/*',
      'discogs-submitter.user.js',
    ],
    stylistic: {
      indent: 2,
      semi: true,
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
      'src/**/*',
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
      // some regexes are dynamic by design
      'e18e/prefer-static-regex': 'off',
      // personal preferences
      'curly': ['error', 'all'],
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
