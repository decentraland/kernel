import { WebWorkerTransport } from '@dcl/rpc/dist/transports/WebWorker'
import { createRpcClient, RpcClient } from '@dcl/rpc'
import { createEnvironmentAPIServiceClient } from 'shared/apis/EnvironmentAPI/client'
import { createEngineAPIServiceClient } from 'shared/apis/EngineAPI/client'
import { resolveMapping } from './sdk/Utils'
import { sleep } from 'atomicHelpers/sleep'

async function start(client: RpcClient) {
  const clientPort = await client.createPort('new-ecs-scene-worker')
  const environmentApiService = await createEnvironmentAPIServiceClient(clientPort)
  const engineApiService = await createEngineAPIServiceClient(clientPort)

  const bootstrapData = await environmentApiService.getBootstrapData({})
  const isPreview = await environmentApiService.isPreviewMode({})

  if (!bootstrapData || !bootstrapData.main) {
    throw new Error(`No boostrap data`)
  }

  const mappingName = bootstrapData.main
  const mapping = bootstrapData.mappings.find(($) => $.file === mappingName)
  const url = resolveMapping(mapping && mapping.hash, mappingName, bootstrapData.baseUrl)
  const codeRequest = await fetch(url)

  if (!codeRequest.ok) {
    throw new Error(`SDK: Error while loading ${url} (${mappingName} -> ${mapping}) the mapping was not found`)
  }

  const sourceCode = await codeRequest.text()

  console.log('from worker', { bootstrapData, isPreview, sourceCode })

  const result = await engineApiService.sendBatch({
    actions: [
      {
        type: 'InitMessagesFinished',
        tag: 'scene',
        payload: '{}'
      }
    ]
  })

  while (true) {
    await sleep(100)
  }
}

createRpcClient(WebWorkerTransport(self))
  .then(start)
  .catch((err) => console.error(err))
