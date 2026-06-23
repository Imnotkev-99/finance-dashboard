// ESLint flat config (v9). Cubre el código de navegador y los módulos/tests.

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  Chart: 'readonly',
  URL: 'readonly',
  FileReader: 'readonly',
  Event: 'readonly',
  performance: 'readonly',
  requestAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  confirm: 'readonly',
  matchMedia: 'readonly'
};

export default [
  {
    files: ['js/app.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error'
    }
  },
  {
    files: ['js/parallax.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error'
    }
  },
  {
    files: ['js/utils.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { URL: 'readonly' }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error'
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly'
      }
    }
  }
];
