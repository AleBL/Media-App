module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:vue/essential'
  ],
  ignorePatterns: [
    'node_modules/',
    'build/',
    'dist/'
  ],
  rules: {
  },
};