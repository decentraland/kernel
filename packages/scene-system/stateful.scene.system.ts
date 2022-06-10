import type { ISceneStateStorageController } from 'shared/apis/SceneStateStorageController/ISceneStateStorageController'
import { DevToolsAdapter } from './sdk/runtime/DevToolsAdapter'
import { RendererStatefulActor } from './stateful-scene/RendererStatefulActor'
import { BuilderStatefulActor } from './stateful-scene/BuilderStatefulActor'
import { serializeSceneState } from './stateful-scene/SceneStateDefinitionSerializer'
import { SceneStateDefinition } from './stateful-scene/SceneStateDefinition'

import { createRpcClient, RpcClient } from '@dcl/rpc'
import { WebWorkerTransport } from '@dcl/rpc/dist/transports/WebWorker'
import { LoadableAPIs, LoadedModules } from 'shared/apis/client'
import { createEventDispatcher, EventCallback, SimpleEvent } from './sdk/runtime/EventDispatcher'

async function startStatefulScene(client: RpcClient) {
  const clientPort = await client.createPort(`stateful-scene-${globalThis.name}`)
  const modules: LoadedModules = {
    EngineAPI: await LoadableAPIs.EngineAPI(clientPort),
    EnvironmentAPI: await LoadableAPIs.EnvironmentAPI(clientPort),
    Permissions: await LoadableAPIs.Permissions(clientPort),
    DevTools: await LoadableAPIs.DevTools(clientPort),
    ParcelIdentity: await LoadableAPIs.ParcelIdentity(clientPort),
    SceneStateStorageController: await LoadableAPIs.SceneStateStorageController(clientPort)
  }

  const devToolsAdapter = new DevToolsAdapter(modules.DevTools)

  const eventDispacherParam: { onEventFunctions: EventCallback[] } = { onEventFunctions: [] }
  function eventReceiver(event: SimpleEvent) {
    for (const cb of eventDispacherParam.onEventFunctions) {
      try {
        cb(event)
      } catch (err) {
        console.error(err)
      }
    }
  }

  const eventDispacther = createEventDispatcher({
    EngineAPI: modules.EngineAPI!,
    devToolsAdapter,
    receiver: eventReceiver
  })
  eventDispacther.start()

  const { cid: sceneId, land: land } = await modules.ParcelIdentity!.getParcel()
  const rendererActor = new RendererStatefulActor(modules, sceneId, eventDispacherParam)

  const builderActor = new BuilderStatefulActor(
    land,
    modules.SceneStateStorageController as any as ISceneStateStorageController
  )
  let sceneDefinition: SceneStateDefinition

  const isEmpty: boolean = await modules.ParcelIdentity!.getIsEmpty()

  //If it is not empty we fetch the state
  if (!isEmpty) {
    // Fetch stored scene
    sceneDefinition = await builderActor.getInititalSceneState()
    await builderActor.sendAssetsFromScene(sceneDefinition)

    // Send the initial state ot the renderer
    sceneDefinition.sendStateTo(rendererActor)

    devToolsAdapter.log('Sent initial load')
  } else {
    sceneDefinition = new SceneStateDefinition()
  }

  // Listen to the renderer and update the local scene state
  rendererActor.forwardChangesTo(sceneDefinition)

  eventDispacherParam.onEventFunctions.push((event) => {
    if (event.type === 'stateEvent') {
      const { type, payload } = event.data
      if (type === 'SaveProjectInfo') {
        modules
          .SceneStateStorageController!.saveProjectInfo(
            serializeSceneState(sceneDefinition),
            payload.title,
            payload.description,
            payload.screenshot
          )
          .catch((error: Error) => devToolsAdapter.error(error))
      } else if (type === 'SaveSceneState') {
        modules
          .SceneStateStorageController!.saveSceneState(serializeSceneState(sceneDefinition))
          .catch((error: Error) => devToolsAdapter.error(error))
      } else if (type === 'PublishSceneState') {
        modules
          .SceneStateStorageController!.publishSceneState(
            sceneId,
            payload.title,
            payload.description,
            payload.screenshot,
            serializeSceneState(sceneDefinition)
          )
          .catch((error: Error) => devToolsAdapter.error(error))
      }
    }
  })

  rendererActor.sendInitFinished()
}

createRpcClient(WebWorkerTransport(self))
  .then(startStatefulScene)
  .catch((err) => console.error(err))
