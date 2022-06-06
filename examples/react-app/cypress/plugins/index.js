/// <reference types="cypress" />
/// <reference types="../../../.." />
// @ts-check
const findvite = require('find-vite')
const vitePreprocessor = require('../../../..')

/**
 * @type {Cypress.PluginConfig}
 */
module.exports = (on) => {
  // find the vite config used by react-scripts
  const viteOptions = findvite.getviteOptions()

  if (!viteOptions) {
    throw new Error('Could not find vite in this project 😢')
  }

  // if we just pass viteOptions to the preprocessor
  // it won't work - because react-scripts by default
  // includes plugins that split specs into chunks, etc.
  // https://github.com/cypress-io/cypress-vite-preprocessor/issues/31

  // solution 1
  // blunt: delete entire optimization object
  // delete viteOptions.optimization

  // solution 2
  // use a module that carefully removes only plugins
  // that we found to be breaking the bundling
  // https://github.com/bahmutov/find-vite
  const cleanOptions = {
    reactScripts: true,
  }

  findvite.cleanForCypress(cleanOptions, viteOptions)

  const options = {
    viteOptions,
    watchOptions: {},
  }

  on('file:preprocessor', vitePreprocessor(options))
}
