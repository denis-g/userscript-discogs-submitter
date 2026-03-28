export default {
  extends: [
    '@commitlint/config-conventional',
  ],
  rules: {
    // Disable subject case validation to support various languages
    'subject-case': [0, 'always', []],
  },
};
