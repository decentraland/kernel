import { AvatarMessageType } from '../comms/interface/types'
import { getUser } from '../comms/peers'
import { avatarMessageObservable } from '../comms/peers'
import { allScenesEvent } from '../world/parcelSceneManager'

const avatarConnected = 'playerConnected'
const avatarDisconnected = 'playerDisconnected'

export function getVisibleAvatarsUserId(): string[] {
  return Array.from(visibleAvatars.values())
}

const visibleAvatars: Map<string, string> = new Map<string, string>()

// Tracks avatar state from comms side.
// Listen to which avatars are visible or removed to keep track of connected and visible players.

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
