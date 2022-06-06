const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    debug: false,
    specPattern: 'cypress/tests/**/*',
    setupNodeEvents (on, config) {
      const vitePreprocessor = require('./index')

      on('file:preprocessor', vitePreprocessor())

      return config
    },
  },
})
