import { AvatarMessageType } from '../comms/interface/types'
import { avatarMessageObservable } from '../comms/peers'
import { allScenesEvent } from '../world/parcelSceneManager'

const avatarConnected = 'playerConnected'
const avatarDisconnected = 'playerDisconnected'

export function getVisibleAvatarsUserId(): string[] {
  return Array.from(visibleAvatars.values())
}

const visibleAvatars: Set<string> = new Set<string>()

// Tracks avatar state from comms side.
// Listen to which avatars are visible or removed to keep track of connected and visible players.
avatarMessageObservable.add((evt) => {
  if (evt.type === AvatarMessageType.USER_VISIBLE) {
    const visible = visibleAvatars.has(evt.userId)

    if (visible !== evt.visible) {
      allScenesEvent({
        eventType: evt.visible ? avatarConnected : avatarDisconnected,
        payload: { userId: evt.userId }
      })

      if (!evt.visible) {
        visibleAvatars.delete(evt.userId)
        return
      }
      visibleAvatars.add(evt.userId)
    }
  } else if (evt.type === AvatarMessageType.USER_REMOVED) {
    if (visibleAvatars.delete(evt.userId)) {
      allScenesEvent({
        eventType: avatarDisconnected,
        payload: { userId: evt.userId }
      })
    }
  }
})
