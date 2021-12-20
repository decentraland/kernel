import { getSceneWorkerBySceneID } from 'shared/world/parcelSceneManager'
import { AvatarRendererMessage, AvatarRendererMessageType } from 'shared/types'

export function* getInSceneAvatarsUserId(sceneId: string): Iterable<string> {
  for (const [userId, avatarData] of rendererAvatars) {
    if (avatarData.sceneId === sceneId) yield userId
  }
}

type RendererAvatarData = {
  sceneId: string
}

const rendererAvatars: Map<string, RendererAvatarData> = new Map<string, RendererAvatarData>()

// Tracks avatar state on the renderer side.
// Set if avatar has change the scene it's in or removed on renderer's side.
export function setRendererAvatarState(evt: AvatarRendererMessage) {
  const userId = evt.avatarShapeId

  if (evt.type === AvatarRendererMessageType.SCENE_CHANGED) {
    // If changed to a scene not loaded on renderer side (sceneId null or empty)
    // we handle it as removed. We will receive another event when the scene where the
    // avatar is in is loaded.
    if (!(evt.sceneId && evt.sceneId.length > 0)) {
      handleRendererAvatarRemoved(userId)
      return
    }

    // Handle avatars spawning or moving to a scene already loaded by the renderer.
    handleRendererAvatarSceneChanged(userId, evt.sceneId)
  } else if (evt.type === AvatarRendererMessageType.REMOVED) {
    handleRendererAvatarRemoved(userId)
  }
}

function handleRendererAvatarSceneChanged(userId: string, sceneId: string) {
  const avatarData: RendererAvatarData | undefined = rendererAvatars.get(userId)

  if (avatarData?.sceneId) {
    const sceneWorker = getSceneWorkerBySceneID(avatarData.sceneId)
    sceneWorker?.emit('onLeaveScene', { userId })
  }

  const sceneWorker = getSceneWorkerBySceneID(sceneId)
  sceneWorker?.emit('onEnterScene', { userId })

  rendererAvatars.set(userId, { sceneId: sceneId })
}

function handleRendererAvatarRemoved(userId: string) {
  const avatarData: RendererAvatarData | undefined = rendererAvatars.get(userId)
  if (avatarData) {
    const sceneWorker = getSceneWorkerBySceneID(avatarData.sceneId)
    sceneWorker?.emit('onLeaveScene', { userId })
    rendererAvatars.delete(userId)
  }
}
