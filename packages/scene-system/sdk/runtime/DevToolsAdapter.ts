import { Protocol } from 'devtools-protocol'
import { LoadedModules } from '../client'

export class DevToolsAdapter {
  exceptions: Error[] = []

  constructor(public devTools: LoadedModules['DevTools']) {}

  log(...args: any[]) {
    const params: Protocol.Runtime.ConsoleAPICalledEvent = {
      type: 'log',
      timestamp: performance.now(),
      executionContextId: 0,
      args: args.map(($) => {
        let value = undefined
        let unserializableValue = undefined
        const type = typeof $
        if (type === 'object' && $ !== null) {
          try {
            JSON.stringify($)
            value = $
          } catch (error) {
            unserializableValue = Object.prototype.toString.apply($)
          }
        } else if (type === 'number' && (isNaN($) || !isFinite($))) {
          unserializableValue = Object.prototype.toString.apply($)
        } else {
          value = $
        }
        const remoteObject: Protocol.Runtime.RemoteObject = {
          type: typeof $,
          value,
          unserializableValue
        }
        return remoteObject
      })
    }

    this.devTools!.event({
      type: 'Runtime.consoleAPICalled',
      jsonPayload: JSON.stringify([params])
    }).catch(this.catchHandler)
  }

  error(e: Error) {
    const exceptionId = this.exceptions.push(e) - 1
    let value: string | void = undefined
    let unserializableValue = undefined
    try {
      value = JSON.stringify(e)
      if (value === '{}' && e instanceof Error) {
        // most Error objects serialize to empty objects
        value = JSON.stringify({
          message: e.message,
          name: e.name,
          stack: e.stack
        })
      }
    } catch (error) {
      unserializableValue = e.toString()
    }
    const exception: Protocol.Runtime.RemoteObject = {
      type: typeof e,
      value,
      unserializableValue
    }
    const param: Protocol.Runtime.ExceptionThrownEvent = {
      timestamp: performance.now(),
      exceptionDetails: {
        text: e.toString() + '\n' + e.stack,
        exceptionId,
        columnNumber: 0,
        lineNumber: 0,
        exception
      }
    }

    this.devTools!.event({
      type: 'Runtime.exceptionThrown',
      jsonPayload: JSON.stringify([param])
    }).catch(this.catchHandler)
  }

  private catchHandler = (...args: any[]) => console.log(...args)
}
