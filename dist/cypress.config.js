var defineConfig = require("cypress").defineConfig;
module.exports = defineConfig({
    e2e: {
        debug: false,
        specPattern: "cypress/tests/**/*",
        setupNodeEvents: function (on, config) {
            var vitePreprocessor = require("./index");
            on("file:preprocessor", vitePreprocessor());
            return config;
        },
    },
});
