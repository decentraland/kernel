import { AvatarMessageType } from 'shared/comms/interface/types'
import { getUser } from 'shared/comms/peers'
import { avatarMessageObservable } from 'shared/comms/peers'
import { allScenesEvent, getSceneWorkerBySceneID } from 'shared/world/parcelSceneManager'
import { Observable } from 'decentraland-ecs'
import { AvatarRendererMessage, AvatarRendererMessageType, ILand } from 'shared/types'
import { encodeParcelPosition, isWorldPositionInsideParcels, worldToGrid } from 'atomicHelpers/parcelScenePositions'
import { fetchSceneIds } from 'decentraland-loader/lifecycle/utils/fetchSceneIds'
import { fetchSceneJson } from 'decentraland-loader/lifecycle/utils/fetchSceneJson'

export const avatarRendererMessageObservable = new Observable<AvatarRendererMessage>()

export function getVisibleAvatarsUserId(): string[] {
  return Array.from(visibleAvatars.values())
}

export function getInSceneAvatarsUserId(sceneId: string): string[] {
  return Array.from(rendererAvatars.entries())
    .filter(([userId, avatarData]) => avatarData.scene && avatarData.scene.sceneId === sceneId)
    .map(([userId, avatarData]) => userId)
}

type RendererAvatarData = {
  scene?: ILand
}

const avatarConnected = 'playerConnected'
const avatarDisconnected = 'playerDisconnected'

const visibleAvatars: Map<string, string> = new Map<string, string>()
const rendererAvatars: Map<string, RendererAvatarData> = new Map<string, RendererAvatarData>()

avatarMessageObservable.add((evt) => {
  if (evt.type === AvatarMessageType.USER_VISIBLE) {
    const visible = visibleAvatars.has(evt.uuid)

    if (visible !== evt.visible) {
      const userId = getUser(evt.uuid)?.userId

      if (!userId) return

      allScenesEvent({
        eventType: evt.visible ? avatarConnected : avatarDisconnected,
        payload: { userId }
      })

      if (!evt.visible) {
        visibleAvatars.delete(evt.uuid)
        return
      }

      visibleAvatars.set(evt.uuid, userId)
    }
  } else if (evt.type === AvatarMessageType.USER_REMOVED) {
    const userId = visibleAvatars.get(evt.uuid)

    if (visibleAvatars.delete(evt.uuid) && userId) {
      allScenesEvent({
        eventType: avatarDisconnected,
        payload: { userId }
      })
    }
  }
})

avatarRendererMessageObservable.add(async (evt) => {
  const userId = evt.avatarShapeId

  if (evt.type === AvatarRendererMessageType.POSITION) {
    let avatarData: RendererAvatarData = {}

    // Get avatar data from map or set a new one if doesn't exist
    if (rendererAvatars.has(userId)) {
      avatarData = rendererAvatars.get(userId)!
    } else {
      rendererAvatars.set(userId, avatarData)
    }

    // Check if avatar didn't move out of last scene
    const prevScene = avatarData.scene
    if (prevScene) {
      if (isWorldPositionInsideParcels(prevScene.sceneJsonData.scene.parcels, evt.position)) {
        return
      }
    }

    // Get current scene
    let currentScene: ILand | undefined

    const coords = worldToGrid(evt.position)
    const scenesId = await fetchSceneIds([encodeParcelPosition(coords)])

    if (scenesId) {
      const scenesJson = await fetchSceneJson(scenesId as string[])
      if (scenesJson) {
        currentScene = scenesJson[0]
        avatarData.scene = currentScene
      }
    }

    // Send scenes events if avatar still exists
    if (rendererAvatars.has(userId)) {
      if (prevScene) {
        const sceneWorker = getSceneWorkerBySceneID(prevScene.sceneId)
        sceneWorker?.emit('onLeaveScene', { userId })
      }

      if (currentScene) {
        const sceneWorker = getSceneWorkerBySceneID(currentScene.sceneId)
        sceneWorker?.emit('onEnterScene', { userId })
      }
    }

    rendererAvatars.set(userId, avatarData)
  } else if (evt.type === AvatarRendererMessageType.REMOVED) {
    const avatarData: RendererAvatarData | undefined = rendererAvatars.get(userId)
    if (avatarData && avatarData.scene) {
      const sceneWorker = getSceneWorkerBySceneID(avatarData.scene.sceneId)
      sceneWorker?.emit('onLeaveScene', { userId })
      rendererAvatars.delete(userId)
    }
  }
})
