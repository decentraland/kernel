import {
  getOwnerNameFromJsonData,
  getSceneNameFromJsonData,
  getThumbnailUrlFromJsonDataAndContent
} from 'shared/selectors'
import { getFetchContentServer } from 'shared/dao/selectors'
import { fetchScenesByLocation } from 'decentraland-loader/lifecycle/utils/fetchSceneIds'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { store } from 'shared/store/isolatedStore'

import { UserActionModuleServiceDefinition } from 'shared/protocol/kernel/apis/UserActionModule.gen'
import { PortContext } from './context'
import { RpcServerPort } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'
import { Scene } from '@dcl/schemas'
import { postProcessSceneName } from 'shared/atlas/selectors'

export function registerUserActionModuleServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, UserActionModuleServiceDefinition, async () => ({
    async requestTeleport(req, ctx) {
      const { destination } = req
      if (destination === 'magic' || destination === 'crowd') {
        getUnityInstance().RequestTeleport({ destination })
        return {}
      } else if (!/^\-?\d+\,\-?\d+$/.test(destination)) {
        ctx.logger.error(`teleportTo: invalid destination ${destination}`)
        return {}
      }

      let sceneEvent = {}
      const sceneData = {
        name: 'Unnamed',
        owner: 'Unknown',
        previewImageUrl: ''
      }

      const mapSceneData = (await fetchScenesByLocation([destination]))[0]

      if (mapSceneData) {
        const metadata: Scene | undefined = mapSceneData?.entity.metadata

        sceneData.name = postProcessSceneName(getSceneNameFromJsonData(metadata))
        sceneData.owner = getOwnerNameFromJsonData(metadata)
        sceneData.previewImageUrl =
          getThumbnailUrlFromJsonDataAndContent(
            mapSceneData.entity.metadata,
            mapSceneData.entity.content,
            getFetchContentServer(store.getState())
          ) || sceneData.previewImageUrl
      } else {
        debugger
      }

      try {
        const response = await fetch(`https://events.decentraland.org/api/events/?position=${destination}`)
        const json = await response.json()
        if (json.data.length > 0) {
          sceneEvent = {
            name: json.data[0].name,
            total_attendees: json.data[0].total_attendees,
            start_at: json.data[0].start_at,
            finish_at: json.data[0].finish_at
          }
        }
      } catch (e: any) {
        ctx.logger.error(e)
      }

      getUnityInstance().RequestTeleport({
        destination,
        sceneEvent,
        sceneData
      })
      return {}
    }
  }))
}
