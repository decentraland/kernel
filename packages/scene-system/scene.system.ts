import { createRpcClient } from '@dcl/rpc'
import { WebWorkerTransport } from '@dcl/rpc/dist/transports/WebWorker'
import { startNewSceneRuntime } from './sdk/NewSceneRuntime'

createRpcClient(WebWorkerTransport(self))
  .then(startNewSceneRuntime)
  .catch((err) => console.error(err))
