import { DevToolsAdapter } from './sdk/runtime/DevToolsAdapter'
import { RendererStatefulActor } from './stateful-scene/RendererStatefulActor'
import { BuilderStatefulActor } from './stateful-scene/BuilderStatefulActor'
import { serializeSceneState } from './stateful-scene/SceneStateDefinitionSerializer'
import { SceneStateDefinition } from './stateful-scene/SceneStateDefinition'

import { createRpcClient, RpcClient } from '@dcl/rpc'
import { WebWorkerTransport } from '@dcl/rpc/dist/transports/WebWorker'
import { LoadableAPIs } from 'shared/apis/client'
import { EventDataToRuntimeEvent, RuntimeEventCallback } from './sdk/runtime/Events'

async function startStatefulScene(client: RpcClient) {
  const clientPort = await client.createPort(`stateful-scene-${globalThis.name}`)
  const [EngineAPI, DevTools, ParcelIdentity, SceneStateStorageController] = await Promise.all([
    LoadableAPIs.EngineAPI(clientPort),
    LoadableAPIs.DevTools(clientPort),
    LoadableAPIs.ParcelIdentity(clientPort),
    LoadableAPIs.SceneStateStorageController(clientPort)
  ])

  const devToolsAdapter = new DevToolsAdapter(DevTools)
  const events: { onEventFunctions: RuntimeEventCallback[] } = { onEventFunctions: [] }

  const { cid: sceneId, land: land } = await ParcelIdentity!.getParcel()
  const rendererActor = new RendererStatefulActor(EngineAPI, sceneId, events)

  const builderActor = new BuilderStatefulActor(land, SceneStateStorageController)
  let sceneDefinition: SceneStateDefinition

  const isEmpty: boolean = await ParcelIdentity!.getIsEmpty()

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

  events.onEventFunctions.push((event) => {
    if (event.type === 'stateEvent') {
      const { type, payload } = event.data
      if (type === 'SaveProjectInfo') {
        SceneStateStorageController!
          .saveProjectInfo(serializeSceneState(sceneDefinition), payload.title, payload.description, payload.screenshot)
          .catch((error: Error) => devToolsAdapter.error(error))
      } else if (type === 'SaveSceneState') {
        SceneStateStorageController!
          .saveSceneState(serializeSceneState(sceneDefinition))
          .catch((error: Error) => devToolsAdapter.error(error))
      } else if (type === 'PublishSceneState') {
        SceneStateStorageController!
          .publishSceneState(
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
  /**
   * This pull the events until the sceneStart event is emitted
   */
  async function waitToStart() {
    try {
      const res = await EngineAPI.pullEvents({})
      for (const e of res.events) {
        const event = EventDataToRuntimeEvent(e)
        for (const cb of events.onEventFunctions) {
          try {
            cb(event)
          } catch (err) {
            console.error(err)
          }
        }
      }
    } catch (err: any) {
      devToolsAdapter.error(err)
    }
    setTimeout(waitToStart, 1000 / 30)
  }

  waitToStart().catch(devToolsAdapter.error)
}

createRpcClient(WebWorkerTransport(self))
  .then(startStatefulScene)
  .catch((err) => console.error(err))
