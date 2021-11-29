import { AvatarMessageType } from 'shared/comms/interface/types'
import { getUser } from 'shared/comms/peers'
import { avatarMessageObservable } from 'shared/comms/peers'
import { allScenesEvent, getSceneWorkerBySceneID } from 'shared/world/parcelSceneManager'
import { Observable } from 'decentraland-ecs'
import { AvatarRendererMessage, AvatarRendererMessageType } from 'shared/types'

export const avatarRendererMessageObservable = new Observable<AvatarRendererMessage>()

export function getVisibleAvatarsUserId(): string[] {
  return Array.from(visibleAvatars.values())
}

export function getInSceneAvatarsUserId(sceneId: string): string[] {
  return Array.from(rendererAvatars.entries())
    .filter(([userId, avatarData]) => avatarData.sceneId === sceneId)
    .map(([userId, avatarData]) => userId)
}

type RendererAvatarData = {
  sceneId: string
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

  if (evt.type === AvatarRendererMessageType.SCENE_CHANGED) {
    // If changed to a scene not loaded on renderer side
    if (!(evt.sceneId && evt.sceneId.length > 0)) {
      const avatarData = rendererAvatars.get(userId)
      if (avatarData) {
        const sceneWorker = getSceneWorkerBySceneID(avatarData.sceneId)
        sceneWorker?.emit('onLeaveScene', { userId })
        rendererAvatars.delete(userId)
      }
      return
    }

    const avatarData: RendererAvatarData | undefined = rendererAvatars.get(userId)
    const newSceneId: string = evt.sceneId

    if (avatarData?.sceneId) {
      const sceneWorker = getSceneWorkerBySceneID(avatarData.sceneId)
      sceneWorker?.emit('onLeaveScene', { userId })
    }

    const sceneWorker = getSceneWorkerBySceneID(newSceneId)
    sceneWorker?.emit('onEnterScene', { userId })

    rendererAvatars.set(userId, { sceneId: newSceneId })
  } else if (evt.type === AvatarRendererMessageType.REMOVED) {
    const avatarData: RendererAvatarData | undefined = rendererAvatars.get(userId)
    if (avatarData) {
      const sceneWorker = getSceneWorkerBySceneID(avatarData.sceneId)
      sceneWorker?.emit('onLeaveScene', { userId })
      rendererAvatars.delete(userId)
    }
  }
})
