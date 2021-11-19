import { AvatarMessageType } from 'shared/comms/interface/types'
import { avatarMessageObservable } from 'shared/comms/peers'
import { allScenesEvent } from 'shared/world/parcelSceneManager'

const avatarConnected = 'playerConnected'
const avatarDisconnected = 'playerDisconnected'

const avatarMap: Record<string, { userId: string; visible: boolean }> = {}

export function getVisibleAvatarsUserId(): string[] {
  return Object.values(avatarMap)
    .filter((value) => value.visible)
    .map((value) => value.userId)
}

avatarMessageObservable.add((evt) => {
  if (evt.type === AvatarMessageType.USER_VISIBLE) {
    if (avatarMap[evt.uuid]) {
      const isVisible = avatarMap[evt.uuid].visible
      const userId = avatarMap[evt.uuid].userId

      if (!userId) {
        return
      }

      if (isVisible != evt.visible) {
        allScenesEvent({
          eventType: evt.visible ? avatarConnected : avatarDisconnected,
          payload: { userId: userId }
        })
      }
      avatarMap[evt.uuid].visible = evt.visible
    }
  } else if (evt.type === AvatarMessageType.USER_DATA) {
    if (!avatarMap[evt.uuid]) {
      avatarMap[evt.uuid] = { userId: evt.profile.userId, visible: false }
    }
  } else if (evt.type === AvatarMessageType.USER_REMOVED) {
    const userId = avatarMap[evt.uuid].userId
    if (!userId) {
      allScenesEvent({
        eventType: avatarDisconnected,
        payload: { userId: userId }
      })
    }
    delete avatarMap[evt.uuid]
  }
})
