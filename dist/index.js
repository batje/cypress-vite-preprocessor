"use strict";
var _ = require("lodash");
var istanbul = require("vite-plugin-istanbul");
var path = require("path");
var debug = require("debug")("cypress:vite");
var debugStats = require("debug")("cypress:vite:stats");
var vite = require("vite");
// bundle promises from input spec filename to output bundled file paths
var bundles = {};
// we don't automatically load the rules, so that the babel dependencies are
// not required if a user passes in their own configuration
var getDefaultviteOptions = function () {
    debug("load default options");
    return {
        configFile: false,
        envFile: false,
        build: {
            emptyOutDir: false,
            minify: true,
            sourcemap: true,
            write: true,
            rollupOptions: {
                output: {
                    preserveModules: false,
                },
            },
        },
    };
};
var replaceErrMessage = function (err, partToReplace, replaceWith) {
    if (replaceWith === void 0) { replaceWith = ""; }
    err.message = _.trim(err.message.replace(partToReplace, replaceWith));
    if (err.stack) {
        err.stack = _.trim(err.stack.replace(partToReplace, replaceWith));
    }
    return err;
};
var cleanModuleNotFoundError = function (err) {
    var message = err.message;
    if (!message.includes("Module not found"))
        return err;
    // vite 5 error messages are much less verbose. No need to clean.
    var startIndex = message.lastIndexOf("resolve ");
    var endIndex = message.lastIndexOf("doesn't exist") + "doesn't exist".length;
    var partToReplace = message.substring(startIndex, endIndex);
    var newMessagePart = "Looked for and couldn't find the file at the following paths:";
    return replaceErrMessage(err, partToReplace, newMessagePart);
};
var cleanMultiNonsense = function (err) {
    var message = err.message;
    var startIndex = message.indexOf("@ multi");
    if (startIndex < 0)
        return err;
    var partToReplace = message.substring(startIndex);
    return replaceErrMessage(err, partToReplace);
};
var quietErrorMessage = function (err) {
    if (!err || !err.message)
        return err;
    // err = cleanModuleNotFoundError(err)
    // err = cleanMultiNonsense(err)
    return err;
};
/**
 * vite preprocessor configuration function. Takes configuration object
 * and returns file preprocessor.
 * @example
  ```
  on('file:preprocessor', vitePreprocessor(options))
  ```
 */
// @ts-ignore
var preprocessor = function (options) {
    if (options === void 0) { options = {}; }
    debug("user options: %o", options);
    // we return function that accepts the arguments provided by
    // the event 'file:preprocessor'
    //
    // this function will get called for the support file when a project is loaded
    // (if the support file is not disabled)
    // it will also get called for a spec file when that spec is requested by
    // the Cypress runner
    //
    // when running in the GUI, it will likely get called multiple times
    // with the same filePath, as the user could re-run the tests, causing
    // the supported file and spec file to be requested again
    return function (file) {
        var _a;
        var filePath = file.filePath;
        debug("get", filePath);
        // since this function can get called multiple times with the same
        // filePath, we return the cached bundle promise if we already have one
        // since we don't want or need to re-initiate vite for it
        if (bundles[filePath]) {
            debug("already have bundle for ".concat(filePath));
            Promise.resolve(bundles[filePath]);
            return;
        }
        var defaultviteOptions = getDefaultviteOptions();
        _.merge(defaultviteOptions, options); //getDefaultviteOptions();
        // we're provided a default output path that lives alongside Cypress's
        // app data files so we don't have to worry about where to put the bundled
        // file on disk
        var outputPath = path.extname(file.outputPath) === ".js"
            ? file.outputPath
            : "".concat(file.outputPath, ".js");
        var filename = path.basename(outputPath);
        var filenameWithoutExtension = path.basename(outputPath, path.extname(outputPath));
        var watchOptions = options.watchOptions || { buildDelay: 0 };
        var viteOptions = defaultviteOptions;
        if (filename.endsWith(".html")) {
            viteOptions.build.rollupOptions = {
                input: (_a = {},
                    _a[filenameWithoutExtension] = filePath,
                    _a),
            };
        }
        else {
            viteOptions.build.outDir = path.dirname(outputPath);
            viteOptions.build.lib = {
                entry: filePath,
                fileName: function () { return filename; },
                formats: ["es"],
                name: filenameWithoutExtension,
            };
            /* viteOptions.plugins = [
              istanbul({
                include: "src/**",
                exclude: ["node_modules", "tests", "results", "dist", "public"],
                extension: [".js", ".ts", ".vue", ".mjs"],
                requireEnv: false,
                //  checkProd: true,
                cypress: true,
              }),
            ];
            */
        }
        if (file.shouldWatch) {
            viteOptions.build.watch = watchOptions;
        }
        debug("viteOptions: %o", viteOptions);
        debug("watchOptions: %o", watchOptions);
        if (options.typescript)
            debug("typescript: %s", options.typescript);
        debug("input: ".concat(filePath));
        debug("output: ".concat(outputPath));
        return new Promise(function (resolve, reject) {
            vite
                .build(viteOptions)
                .then(function (watcher) {
                if (file.shouldWatch) {
                    watcher.on("event", function (event) {
                        if (event.code === "END") {
                            file.emit("rerun");
                        }
                    });
                    file.on("close", function () {
                        watcher.close();
                    });
                    watcher.on("event", function (e) {
                        if (e.code === "ERROR") {
                            reject(e);
                        }
                    });
                }
                bundles[filePath] = outputPath;
                resolve(outputPath);
            })
                .catch(function (error) {
                console.error(error);
                reject(error);
            });
        });
    };
};
// provide a clone of the default options
Object.defineProperty(preprocessor, "defaultOptions", {
    get: function () {
        debug("get default options");
        return {
            viteOptions: getDefaultviteOptions(),
            watchOptions: {},
        };
    },
});
// for testing purposes, but do not add this to the typescript interface
// @ts-ignore
preprocessor.__reset = function () {
    bundles = {};
};
// for testing purposes, but do not add this to the typescript interface
// @ts-ignore
preprocessor.__bundles = function () {
    return bundles;
};
module.exports = preprocessor;
