// tslint:disable:no-console
export type ILogger = {
  error(message: string, ...args: any[]): void
  log(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  trace(message: string, ...args: any[]): void
}

export function createDummyLogger(): ILogger {
  return {
    error(_message: string | Error, ..._args: any[]): void {
      /*nothing*/
    },
    log(_message: string, ..._args: any[]): void {
      /*nothing*/
    },
    warn(_message: string, ..._args: any[]): void {
      /*nothing*/
    },
    info(_message: string, ..._args: any[]): void {
      /*nothing*/
    },
    trace(_message: string, ..._args: any[]): void {
      /*nothing*/
    }
  }
}

export function createLogger(prefix: string): ILogger {
  const kernelPrefix = `kernel:${prefix} `
  return {
    error(message: string | Error, ...args: any[]): void {
      if (typeof message === 'object' && message.stack) {
        console.error(kernelPrefix + message, ...args, message.stack)
      } else {
        console.error(kernelPrefix + message, ...args)
      }
    },
    log(message: string, ...args: any[]): void {
      if (args && args[0] && args[0].startsWith && args[0].startsWith('The entity is already in the engine.')) {
        return
      }
      console.log(kernelPrefix + message, ...args)
    },
    warn(message: string, ...args: any[]): void {
      console.log(kernelPrefix + message, ...args)
    },
    info(message: string, ...args: any[]): void {
      console.info(kernelPrefix + message, ...args)
    },
    trace(message: string, ...args: any[]): void {
      console.trace(kernelPrefix + message, ...args)
    }
  }
}

export const defaultLogger: ILogger = createLogger('')

export default defaultLogger
