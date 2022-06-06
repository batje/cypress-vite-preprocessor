import { defineConfig } from 'cypress'

export default defineConfig({
  'fixturesFolder': false,
  'e2e': {
    'supportFile': false,
    async setupNodeEvents (on, config) {
      const vitePreprocessor = await import('../..')

      const vite = await import('./vite.config')

      on('file:preprocessor', vitePreprocessor({ vite }))

      return config
    },
  },
})
