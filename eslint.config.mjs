import js from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from '@vue/eslint-config-typescript';
import skipFormatting from 'eslint-config-prettier/flat';

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,cjs,ts,mts,vue}'],
  },
  {
    name: 'app/ignores',
    ignores: [
      'dist/**',
      'dist-electron/**',
      'release/**',
      'public/**',
      '**/*.d.ts',
      // vendored code
      'src/presets/**',
      'src/util/tmdb.js',
    ],
  },

  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,

  {
    name: 'app/globals',
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    name: 'app/commonjs-files',
    files: ['*.config.js', 'src/util/fetchGenres.js', 'src/util/languages.js'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    name: 'app/rules',
    rules: {
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      '@typescript-eslint/no-require-imports': 'off',
      // {} and Function are used as loose types in a few places
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },

  // Formatting belongs to Prettier (npm run format): this turns off every
  // rule that would disagree with it.
  skipFormatting,
  {
    name: 'app/self-closing',
    rules: {
      // Not covered by Prettier, and compatible with it in this form
      'vue/html-self-closing': [
        'error',
        {
          html: { void: 'always', normal: 'always', component: 'always' },
          svg: 'always',
          math: 'always',
        },
      ],
    },
  },
);
