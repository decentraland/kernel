import { getOwnerNameFromJsonData, getThumbnailUrlFromJsonDataAndContent } from 'shared/selectors'
import { getFetchContentServer } from 'shared/dao/selectors'
import { fetchSceneIds } from 'decentraland-loader/lifecycle/utils/fetchSceneIds'
import { fetchSceneJson } from 'decentraland-loader/lifecycle/utils/fetchSceneJson'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { store } from 'shared/store/isolatedStore'

import { UserActionModuleServiceDefinition } from './../gen/UserActionModule'
import { PortContext } from './context'
import { RpcServerPort } from '@dcl/rpc'
import * as codegen from '@dcl/rpc/dist/codegen'
import { getSceneNameFromAtlasState, postProcessSceneName } from 'shared/atlas/selectors'

export function registerUserActionModuleServiceServerImplementation(port: RpcServerPort<PortContext>) {
  function getSceneName(baseCoord: string, sceneJsonData: any): string {
    const sceneName = getSceneNameFromAtlasState(sceneJsonData) ?? store.getState().atlas.tileToScene[baseCoord]?.name
    return postProcessSceneName(sceneName)
  }

  codegen.registerService(port, UserActionModuleServiceDefinition, async () => ({
    async requestTeleport(req, ctx) {
      const { destination } = req
      if (destination === 'magic' || destination === 'crowd') {
        getUnityInstance().RequestTeleport({ destination })
        return {}
      } else if (!/^\-?\d+\,\-?\d+$/.test(destination)) {
        ctx.DevTools.logger.error(`teleportTo: invalid destination ${destination}`)
        return {}
      }

      let sceneThumbnailUrl: string | undefined
      let sceneName: string = destination
      let sceneCreator: string = 'Unknown'
      let sceneEvent = {}

      const sceneId = (await fetchSceneIds([destination]))[0]
      const mapSceneData = sceneId ? (await fetchSceneJson([sceneId!]))[0] : undefined

      sceneName = getSceneName(destination, mapSceneData?.sceneJsonData)
      sceneCreator = getOwnerNameFromJsonData(mapSceneData?.sceneJsonData)

      if (mapSceneData) {
        sceneThumbnailUrl = getThumbnailUrlFromJsonDataAndContent(
          mapSceneData.sceneJsonData,
          mapSceneData.mappingsResponse.contents,
          getFetchContentServer(store.getState())
        )
      }
      if (!sceneThumbnailUrl) {
        let sceneParcels = [destination]
        if (mapSceneData && mapSceneData.sceneJsonData?.scene.parcels) {
          sceneParcels = mapSceneData.sceneJsonData.scene.parcels
        }
        sceneThumbnailUrl = `https://api.decentraland.org/v1/map.png?width=480&height=237&size=10&center=${destination}&selected=${sceneParcels.join(
          ';'
        )}`
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
        ctx.DevTools.logger.error(e)
      }

      getUnityInstance().RequestTeleport({
        destination,
        sceneEvent,
        sceneData: {
          name: sceneName,
          owner: sceneCreator,
          previewImageUrl: sceneThumbnailUrl ?? ''
        }
      })
      return {}
    }
  }))
}
