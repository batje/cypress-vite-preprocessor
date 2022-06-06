module.exports = {
  'fixturesFolder': false,
  'e2e': {
    'supportFile': false,
    setupNodeEvents (on, config) {
      const vitePreprocessor = require('../..')
      const defaults = vitePreprocessor.defaultOptions

      delete defaults.viteOptions.module.rules[0].use[0].options.presets
      on('file:preprocessor', vitePreprocessor(defaults))

      return config
    },
  },
}
