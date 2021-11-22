import { AvatarMessageType } from 'shared/comms/interface/types'
import { getUser } from 'shared/comms/peers'
import { avatarMessageObservable } from 'shared/comms/peers'
import { allScenesEvent } from 'shared/world/parcelSceneManager'

const avatarConnected = 'playerConnected'
const avatarDisconnected = 'playerDisconnected'

const visibleAvatars: Map<string, string> = new Map<string, string>()

export function getVisibleAvatarsUserId(): string[] {
  return Array.from(visibleAvatars.values())
}

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
