import * as viteImport from "vite";
import * as events from "events";
import * as _ from "lodash";
const istanbul = require("vite-plugin-istanbul");

const path = require("path");
const debug = require("debug")("cypress:vite");
const debugStats = require("debug")("cypress:vite:stats");
const vite = require("vite");

type FilePath = string;

// bundle promises from input spec filename to output bundled file paths
let bundles: { [key: string]: string } = {};

// we don't automatically load the rules, so that the babel dependencies are
// not required if a user passes in their own configuration
const getDefaultviteOptions = (): viteImport.InlineConfig => {
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

const replaceErrMessage = (
  err: Error,
  partToReplace: string,
  replaceWith = ""
) => {
  err.message = _.trim(err.message.replace(partToReplace, replaceWith));

  if (err.stack) {
    err.stack = _.trim(err.stack.replace(partToReplace, replaceWith));
  }

  return err;
};

const cleanModuleNotFoundError = (err: Error) => {
  const message = err.message;

  if (!message.includes("Module not found")) return err;

  // vite 5 error messages are much less verbose. No need to clean.

  const startIndex = message.lastIndexOf("resolve ");
  const endIndex =
    message.lastIndexOf(`doesn't exist`) + `doesn't exist`.length;
  const partToReplace = message.substring(startIndex, endIndex);
  const newMessagePart = `Looked for and couldn't find the file at the following paths:`;

  return replaceErrMessage(err, partToReplace, newMessagePart);
};

const cleanMultiNonsense = (err: Error) => {
  const message = err.message;
  const startIndex = message.indexOf("@ multi");

  if (startIndex < 0) return err;

  const partToReplace = message.substring(startIndex);

  return replaceErrMessage(err, partToReplace);
};

const quietErrorMessage = (err: Error) => {
  if (!err || !err.message) return err;

  // err = cleanModuleNotFoundError(err)
  // err = cleanMultiNonsense(err)

  return err;
};

/**
 * Configuration object for this vite preprocessor
 */
interface PreprocessorOptions {
  viteOptions?: viteImport.InlineConfig;
  watchOptions?: Object;
  typescript?: string;
}

interface FileEvent extends events.EventEmitter {
  filePath: FilePath;
  outputPath: string;
  shouldWatch: boolean;
}

/**
 * Cypress asks file preprocessor to bundle the given file
 * and return the full path to produced bundle.
 */
type FilePreprocessor = (file: FileEvent) => Promise<FilePath>;

type vitePreprocessorFn = (options: PreprocessorOptions) => FilePreprocessor;

/**
 * Cypress file preprocessor that can bundle specs
 * using vite.
 */
interface vitePreprocessor extends vitePreprocessorFn {
  /**
   * Default options for Cypress vite preprocessor.
   * You can modify these options then pass to the preprocessor.
   * @example
    ```
    const defaults = vitePreprocessor.defaultOptions
    module.exports = (on) => {
      on('file:preprocessor', vitePreprocessor(defaults))
    }
    ```
   *
   * @type {<PreprocessorOptions>}
   * @memberof vitePreprocessor
   */
  defaultOptions: PreprocessorOptions;
}

/**
 * vite preprocessor configuration function. Takes configuration object
 * and returns file preprocessor.
 * @example
  ```
  on('file:preprocessor', vitePreprocessor(options))
  ```
 */
// @ts-ignore
const preprocessor: vitePreprocessor = (
  options: PreprocessorOptions = {}
): FilePreprocessor => {
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
  return (file: FileEvent) => {
    const filePath = file.filePath;

    debug("get", filePath);

    // since this function can get called multiple times with the same
    // filePath, we return the cached bundle promise if we already have one
    // since we don't want or need to re-initiate vite for it
    if (bundles[filePath]) {
      debug(`already have bundle for ${filePath}`);

      Promise.resolve(bundles[filePath]);
      return;
    }

    let defaultviteOptions = getDefaultviteOptions();
    _.merge(defaultviteOptions, options); //getDefaultviteOptions();

    // we're provided a default output path that lives alongside Cypress's
    // app data files so we don't have to worry about where to put the bundled
    // file on disk
    const outputPath =
      path.extname(file.outputPath) === ".js"
        ? file.outputPath
        : `${file.outputPath}.js`;

    const filename = path.basename(outputPath);

    const filenameWithoutExtension = path.basename(
      outputPath,
      path.extname(outputPath)
    );

    const watchOptions = options.watchOptions || { buildDelay: 0 };

    let viteOptions = defaultviteOptions;
    if (filename.endsWith(".html")) {
      viteOptions.build.rollupOptions = {
        input: {
          [filenameWithoutExtension]: filePath,
        },
      };
    } else {
      viteOptions.build.outDir = path.dirname(outputPath);
      viteOptions.build.lib = {
        entry: filePath,
        fileName: () => filename,
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
    if (options.typescript) debug("typescript: %s", options.typescript);

    debug(`input: ${filePath}`);
    debug(`output: ${outputPath}`);
    return new Promise((resolve, reject) => {
      vite
        .build(viteOptions)
        .then(function (watcher) {
          if (file.shouldWatch) {
            watcher.on("event", (event) => {
              if (event.code === "END") {
                file.emit("rerun");
              }
            });
            file.on("close", () => {
              watcher.close();
            });
            watcher.on("event", (e) => {
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
  get() {
    debug("get default options");

    return {
      viteOptions: getDefaultviteOptions(),
      watchOptions: {},
    };
  },
});

// for testing purposes, but do not add this to the typescript interface
// @ts-ignore
preprocessor.__reset = () => {
  bundles = {};
};

// for testing purposes, but do not add this to the typescript interface
// @ts-ignore
preprocessor.__bundles = () => {
  return bundles;
};

export = preprocessor;
