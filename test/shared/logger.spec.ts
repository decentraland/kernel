import * as sinon from 'sinon'
import { expect } from "chai"
import * as wrapConsole from 'shared/logger/wrap'
import { defaultLogger } from 'shared/logger'

describe('Wrapped Logger', () => {
  wrapConsole.METHODS.forEach(method => {
    describe(`Wrapped Console.${method}`, () => {
      it('should log everything without prefix', () => {
        const a = sinon.spy(wrapConsole._console, method)
        wrapConsole.default('*')
        const message = 'Some'
        console[method](message)
        expect(a.calledWith(message)).to.equal(true)
      })

      it('should NOT log if the message doenst match the prefix', () => {
        const a = sinon.spy(wrapConsole._console, method)
        const prefix = 'kernel: '
        wrapConsole.default(prefix)

        // No prefix
        const message = 'Some message without prefix'
        console[method](message)
        expect(a.called).to.equal(false)

        // Prefix with multiple args
        console[method](prefix, message)
        expect(a.calledWith(prefix ,message)).to.equal(true)

        // Prefix with single arg
        console[method](prefix + message)
        expect(a.calledWith(prefix + message)).to.equal(true)
      })

      it('should log with multiple prefixes', () => {
        const spy = sinon.spy(wrapConsole._console, method)
        const kernelPrefix = 'kernel: '
        const unityPrefix = 'unity: '
        const prefix = `${kernelPrefix},${unityPrefix}`
        wrapConsole.default(prefix)
        const message = 'Some message without prefix'

        // No prefix
        console[method](message)
        expect(spy.called).to.equal(false)

        // Kernel prefix
        console[method](kernelPrefix, message)
        expect(spy.calledWith(kernelPrefix ,message)).to.equal(true)

        // Unity prefix
        console[method](unityPrefix + message)
        expect(spy.calledWith(unityPrefix + message)).to.equal(true)
      })

      it('should log an object correctly', () => {
        const spy = sinon.spy(wrapConsole._console, method)
        const prefix = '*'
        wrapConsole.default(prefix)
        const message = { someMessage: true }
        defaultLogger.error(message as any)
        expect(spy.calledWith(message)).to.equal(true)
      })
    })
  })
})
