import { Vector2 } from '@dcl/ecs-math'

import { worldToGrid } from '../../atomicHelpers/parcelScenePositions'
import { avatarMessageObservable } from '../comms/peers'
import { AvatarMessageType } from '../comms/interface/types'
import { positionObservable } from '../world/positionThings'
import { trackEvent } from '.'

const TRACEABLE_AVATAR_EVENTS = [
  AvatarMessageType.ADD_FRIEND,
  AvatarMessageType.SET_LOCAL_UUID,
  AvatarMessageType.USER_MUTED,
  AvatarMessageType.USER_UNMUTED,
  AvatarMessageType.USER_BLOCKED,
  AvatarMessageType.USER_UNBLOCKED
]

export function hookAnalyticsObservables() {
  avatarMessageObservable.add(({ type, ...data }) => {
    if (!TRACEABLE_AVATAR_EVENTS.includes(type)) {
      return
    }

    trackEvent(type, data)
  })

  let lastTime: number = performance.now()

  let previousPosition: string | null = null
  const gridPosition = Vector2.Zero()

  positionObservable.add(({ position }) => {
    // Update seconds variable and check if new parcel
    if (performance.now() - lastTime > 1000) {
      worldToGrid(position, gridPosition)
      const currentPosition = `${gridPosition.x | 0},${gridPosition.y | 0}`
      if (previousPosition !== currentPosition) {
        trackEvent('Move to Parcel', {
          newParcel: currentPosition,
          oldParcel: previousPosition,
          exactPosition: { x: position.x, y: position.y, z: position.z }
        })
        previousPosition = currentPosition
      }
      lastTime = performance.now()
    }
  })
}
