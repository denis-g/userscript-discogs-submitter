import antfu from '@antfu/eslint-config';
import userscripts from 'eslint-plugin-userscripts';
import globals from 'globals';

export default antfu(
  {
    ignores: [
      '**/.eslintcache',
      'node_modules/*',
    ],
    stylistic: {
      indent: 2,
      semi: true,
    },
    jsonc: true,
    markdown: true,
    // only Vanilla JS
    typescript: false,
    jsx: false,
    vue: false,
    yaml: false,
    toml: false,
    angular: false,
  },

  {
    files: ['discogs-submitter.user.js'],
    plugins: {
      userscripts: {
        rules: userscripts.rules,
      },
    },
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...globals.greasemonkey,
      },
    },
    rules: {
      // no defining regular expression
      'e18e/prefer-static-regex': 'off',
      // default rules
      ...userscripts.configs.recommended.rules,
      // Tampermonkey rules
      // https://github.com/Tampermonkey/tampermonkey/issues/1686#issuecomment-1403657330
      'curly': [1, 'multi-line'],
      'dot-location': 0,
      'dot-notation': [1, { allowKeywords: true }],
      'no-caller': 1,
      'no-case-declarations': 2,
      'no-div-regex': 0,
      'no-empty-pattern': 2,
      'no-eq-null': 0,
      'no-eval': 1,
      'no-extra-bind': 1,
      'no-fallthrough': 1,
      'no-implicit-globals': 2,
      'no-implied-eval': 1,
      'no-lone-blocks': 1,
      'no-loop-func': 1,
      'no-multi-spaces': 1,
      'no-multi-str': 1,
      'no-native-reassign': 1,
      'no-octal-escape': 2,
      'no-octal': 2,
      'no-proto': 1,
      'no-redeclare': 2,
      'no-return-assign': 1,
      'no-sequences': 1,
      'no-undef': 1,
      'no-useless-call': 1,
      'no-useless-concat': 1,
      'no-with': 1,
    },
  },
);
