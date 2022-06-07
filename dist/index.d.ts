/// <reference types="node" />
import * as viteImport from "vite";
import * as events from "events";
declare type FilePath = string;
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
declare type FilePreprocessor = (file: FileEvent) => Promise<FilePath>;
declare type vitePreprocessorFn = (options: PreprocessorOptions) => FilePreprocessor;
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
declare const preprocessor: vitePreprocessor;
export = preprocessor;
