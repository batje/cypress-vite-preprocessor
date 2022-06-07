'use strict'

const chai = require('chai')
const mockery = require('mockery')
const Promise = require('bluebird')
const sinon = require('sinon')

const expect = chai.expect

chai.use(require('sinon-chai'))

const vite = sinon.stub()

mockery.enable({
  warnOnUnregistered: false,
})

mockery.registerMock('vite', vite)

const preprocessor = require('../../index')
const typescriptOverrides = require('../../lib/typescript-overrides')

describe('vite preprocessor', function () {
  beforeEach(function () {
    vite.reset()
    sinon.restore()

    this.watchApi = {
      close: sinon.spy(),
    }

    this.compilerApi = {
      build: sinon.stub(),
    }

    vite.returns(this.compilerApi)

    this.file = {
      filePath: 'path/to/file.js',
      outputPath: 'output/output.js',
      shouldWatch: false,
      on: sinon.stub(),
      emit: sinon.spy(),
    }

    this.util = {
      getOutputPath: sinon.stub().returns(this.outputPath),
      fileUpdated: sinon.spy(),
      onClose: sinon.stub(),
    }

    this.build = (options, file = this.file) => {
      return preprocessor(options)(file)
    }
  })

  describe('exported function', function () {
    it('receives user options and returns a preprocessor function', function () {
      expect(preprocessor(this.options)).to.be.a('function')
    })

    it('has defaultOptions attached to it', function () {
      expect(preprocessor.defaultOptions).to.be.an('object')
      expect(preprocessor.defaultOptions.viteOptions.build.emptyOutDir).to.be.a('boolean')
    })

  })

  describe('preprocessor function', function () {
    afterEach(function () {
      this.file.on.withArgs('close').yield() // resets the cached bundles
    })

    describe('when it finishes cleanly', function () {
      beforeEach(function () {
        this.compilerApi.build.yields(null)
      })

     /* it('runs vite', function () {
        expect(preprocessor.__bundles()[this.file.filePath]).to.be.undefined

        return this.run().then(() => {
        //  expect(preprocessor.__bundles()[this.file.filePath].deferreds).to.be.empty
          //expect(preprocessor.__bundles()[this.file.filePath]).to.be.instanceOf(Promise)
          expect(vite.build).to.be.called
        })
      })
      */

      /*it('returns existing bundle if called again with same filePath', function () {
        vite.reset()
        vite.returns(this.compilerApi)

        const build = preprocessor(this.options)

        build(this.file)
        build(this.file)
        expect(vite).to.be.calledOnce
      })*/

      it('specifies the entry file', function () {
        return this.build().then(() => {
          expect(vite).to.be.calledWithMatch({
            entry: [this.file.filePath],
          })
        })
      })

      it('includes additional entry files', function () {
        return this.build({
          additionalEntries: ['entry-1.js', 'entry-2.js'],
        }).then(() => {
          expect(vite).to.be.calledWithMatch({
            entry: [
              this.file.filePath,
              'entry-1.js',
              'entry-2.js',
            ],
          })
        })
      })

      it('specifies output path and filename', function () {
        return this.run().then(() => {
          expect(vite).to.be.calledWithMatch({
            output: {
              path: 'output',
              filename: 'output.js',
            },
          })
        })
      })

      it('adds .js extension to filename when the originating file had been no javascript file', function () {
        this.file.outputPath = 'output/output.ts'

        return this.run().then(() => {
          expect(vite.lastCall.args[0].output).to.eql({
            path: 'output',
            filename: 'output.ts.js',
          })
        })
      })

      describe('devtool', function () {
        beforeEach((() => {
          sinon.stub(typescriptOverrides, 'overrideSourceMaps')
        }))

        it('enables inline source maps', function () {
          return this.run().then(() => {
            expect(vite).to.be.calledWithMatch({
              devtool: 'inline-source-map',
            })

            expect(typescriptOverrides.overrideSourceMaps).to.be.calledWith(true)
          })
        })

        it('does not enable inline source maps when devtool is false', function () {
          const options = { viteOptions: { devtool: false } }

          return this.run(options).then(() => {
            expect(vite).to.be.calledWithMatch({
              devtool: false,
            })

            expect(typescriptOverrides.overrideSourceMaps).to.be.calledWith(false)
          })
        })

        it('always sets devtool even when mode is "production"', function () {
          const options = { viteOptions: { mode: 'production' } }

          return this.run(options).then(() => {
            expect(vite).to.be.calledWithMatch({
              devtool: 'inline-source-map',
            })

            expect(typescriptOverrides.overrideSourceMaps).to.be.calledWith(true)
          })
        })
      })

      describe('mode', function () {
        it('sets mode to development by default', function () {
          return this.run().then(() => {
            expect(vite).to.be.calledWithMatch({
              mode: 'development',
            })
          })
        })

        it('follows user mode if present', function () {
          const options = { viteOptions: { mode: 'production' } }

          return this.run(options).then(() => {
            expect(vite).to.be.calledWithMatch({
              mode: 'production',
            })
          })
        })
      })

      it('runs when shouldWatch is false', function () {
        return this.run().then(() => {
          expect(this.compilerApi.run).to.be.called
        })
      })

      it('resolves with the output path', function () {
        return this.run().then((outputPath) => {
          expect(outputPath).to.be.equal(this.file.outputPath)
        })
      })

      it('adds .js extension and resolves with that output path when the originating file had been no javascript file', function () {
        this.file.outputPath = 'output/output.ts'

        return this.run().then((outputPath) => {
          expect(outputPath).to.be.equal('output/output.ts.js')
        })
      })

      it('emits "rerun" when shouldWatch is true after there is an update', function () {
        this.file.shouldWatch = true
        this.compilerApi.run.yields(null)

        return this.run()
        .then(() => {
          expect(this.file.emit).not.to.be.calledWith('rerun')

          this.compilerApi.run.yield(null)

          return Promise.delay(11) // give assertion time till next tick
        })
        .then(() => {
          expect(this.file.emit).to.be.calledWith('rerun')
        })
      })

      it('does not emit "rerun" when shouldWatch is false', function () {
        this.file.shouldWatch = false

        return this.run().then(() => {
          expect(this.file.emit).not.to.be.calledWith('rerun')
        })
      })

      it('closes bundler when shouldWatch is true and `close` is emitted', function () {
        this.file.shouldWatch = true
        this.compilerApi.watch.yields(null)

        return this.run().then(() => {
          this.file.on.withArgs('close').yield()
          expect(this.watchApi.close).to.be.called
        })
      })

      it('does not close bundler when shouldWatch is false and `close` is emitted', function () {
        return this.run().then(() => {
          this.file.on.withArgs('close').yield()
          expect(this.watchApi.close).not.to.be.called
        })
      })

      it('uses default vite options when no user options', function () {
        return this.run().then(() => {
          expect(vite.lastCall.args[0].module.rules[0].use).to.have.length(1)
          expect(vite.lastCall.args[0].module.rules[0].use[0].loader).to.be.a('string')
        })
      })

      it('uses default options when no user vite options', function () {
        return this.run({}).then(() => {
          expect(vite.lastCall.args[0].module.rules[0].use).to.have.length(1)
          expect(vite.lastCall.args[0].module.rules[0].use[0].loader).to.be.a('string')
        })
      })

      it('does not use default options when user options are non-default', function () {
        const options = { viteOptions: { module: { rules: [] } } }

        return this.run(options).then(() => {
          expect(vite).to.be.calledWithMatch({
            module: options.viteOptions.module,
          })
        })
      })
    })

    describe('when it errors', function () {
      beforeEach(function () {
        this.err = {
          stack: 'Failed to preprocess...',
        }
      })

      it('it rejects with error when an err', function () {
        this.compilerApi.run.yields(this.err)
        expect(preprocessor.__bundles()[this.file.filePath]).to.be.undefined

        return this.run().catch((err) => {
          expect(preprocessor.__bundles()[this.file.filePath].deferreds).to.be.empty
          expect(preprocessor.__bundles()[this.file.filePath].promise).to.be.instanceOf(Promise)
          expect(err.stack).to.equal(this.err.stack)
        })
      })
    })
  })
})
