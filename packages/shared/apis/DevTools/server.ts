import { RpcServerPort } from '@dcl/rpc/dist/types'
import * as codegen from '@dcl/rpc/dist/codegen'
import { DevToolsBody, DevToolsServiceDefinition, Empty } from './gen/DevTools'
import Protocol from 'devtools-protocol'
import { ProtocolMapping } from 'devtools-protocol/types/protocol-mapping'
import { ILogger } from './../../logger'
import { DEBUG } from './../../../config'

export type DevToolsContext = {
  logger: ILogger
  logs: Protocol.Runtime.ConsoleAPICalledEvent[]
  exceptions: Map<number, Protocol.Runtime.ExceptionDetails>
}

export function registerDevToolsServiceServerImplementation(port: RpcServerPort<any>) {
  codegen.registerService(port, DevToolsServiceDefinition, async () => ({
    async event(req: DevToolsBody, context): Promise<Empty> {
      const params = JSON.parse(req.jsonPayload)
      switch (req.type) {
        case 'Runtime.consoleAPICalled': {
          const [event] = params as ProtocolMapping.Events['Runtime.consoleAPICalled']

          if (DEBUG) {
            context.logs.push(event)
          }

          context.logger.log('', ...event.args.map(($) => ('value' in $ ? $.value : $.unserializableValue)))

          break
        }

        case 'Runtime.exceptionThrown': {
          const [payload] = params as ProtocolMapping.Events['Runtime.exceptionThrown']
          context.exceptions.set(payload.exceptionDetails.exceptionId, payload.exceptionDetails)

          if (payload.exceptionDetails.exception) {
            context.logger.error(
              payload.exceptionDetails.text,
              payload.exceptionDetails.exception.value || payload.exceptionDetails.exception.unserializableValue
            )
          } else {
            context.logger.error(payload.exceptionDetails.text)
          }
          break
        }
      }

      return {}
    }
  }))
}
