This is an example React application clone from [codesandbox.io](https://codesandbox.io/s/oj3qm2zq06) and blog post [How To Build a React To-Do App with React Hooks](https://www.digitalocean.com/community/tutorials/how-to-build-a-react-to-do-app-with-react-hooks).

Because the application is using `react-scripts`, we can point our Cypress vite preprocessor at the vite config included with `react-scripts` module. See [cypress/plugins/index.js](cypress/plugins/index.js) file.

**Tip:** you can use [find-vite](https://github.com/bahmutov/find-vite) utility to find the vite config options provided by common tools: `react-scripts`, Vue CLI.

## Chunks and dynamic imports

Normally, a code that uses [dynamic imports](https://github.com/tc39/proposal-dynamic-import) is bundled by vite into a separate JavaScript bundle (chunk) to be loaded on demand. Cypress needs all chunks to be in the same bundled file, since it cannot be serving additional files, besides the spec itself. Thus we need to force all chunks into the single bundle by changing the vite plugins' options.

See [cypress/integration/dynamic-import-spec.js](cypress/integration/dynamic-import-spec.js) and the [cypress/plugins/index.js](cypress/plugins/index.js) file - it uses [find-vite cleanForCypress](https://github.com/bahmutov/find-vite) utility to force dynamic imports into the same spec bundle.
