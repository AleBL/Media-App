module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  ignorePatterns: [
    'dist-electron/',
    '.output/',
    'dist/',
    'public/',
    '**/*.min.js',
    '**/*.d.ts',
    'src/presets/',
    'src/util/tmdb.js',
  ],
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    '@vue/eslint-config-typescript/recommended',
    'eslint-config-prettier',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'vue/singleline-html-element-content-newline': 0,
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
    'vue/no-v-model-argument': 0,
    '@typescript-eslint/no-var-requires': 0,
    'vue/no-v-html': 0,
    'vue/html-indent': ['error', 2],
    'no-tabs': ['error', { allowIndentationTabs: false }],
    'vue/script-indent': [
      'error',
      2,
      {
        baseIndent: 1,
        switchCase: 1,
        ignores: [],
      },
    ],
    '@typescript-eslint/ban-types': [
      'error',
      {
        extendDefaults: true,
        types: {
          '{}': false,
          Function: false,
        },
      },
    ],
    'vue/html-self-closing': [
      'error',
      {
        html: {
          void: 'always',
          normal: 'always',
          component: 'always',
        },
        svg: 'always',
        math: 'always',
      },
    ],
    semi: ['error', 'always'],
    'eol-last': ['error', 'always'],
    quotes: ['error', 'single'],
  },
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        indent: ['error', 2, { SwitchCase: 1 }],
      },
    },
  ],
  globals: {
    _: true,
    t: true,
  },
};
