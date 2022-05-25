import { WebWorkerTransport } from '@dcl/rpc/dist/transports/WebWorker'
import { createRpcClient, RpcClient } from '@dcl/rpc'
import { createEnvironmentAPIServiceClient } from 'shared/apis/EnvironmentAPI/client'

async function start(client: RpcClient) {
  const clientPort = await client.createPort('new-ecs-scene-worker')
  const environmentApiService = await createEnvironmentAPIServiceClient(clientPort)

  const data = await environmentApiService.getBootstrapData({})
  console.log({ data })
  debugger
}

createRpcClient(WebWorkerTransport(self))
  .then(start)
  .catch((err) => console.error(err))
