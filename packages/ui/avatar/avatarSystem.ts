import { AvatarShape, engine, Entity, Observable, Transform, EventManager } from '@dcl/legacy-ecs'
import {
  AvatarMessage,
  AvatarMessageType,
  Pose,
  ReceiveUserDataMessage,
  ReceiveUserExpressionMessage,
  ReceiveUserTalkingMessage,
  ReceiveUserVisibleMessage,
  UserInformation,
  UserRemovedMessage,
  UUID
} from 'shared/comms/interface/types'
import type { NewProfileForRenderer } from 'shared/profiles/transformations/profileToRendererFormat'
export const avatarMessageObservable = new Observable<AvatarMessage>()

const avatarMap = new Map<string, AvatarEntity>()

export class AvatarEntity extends Entity {
  visible = true

  transform: Transform
  avatarShape!: AvatarShape

  constructor(uuid?: string, avatarShape = new AvatarShape()) {
    super(uuid)
    this.avatarShape = avatarShape

    this.addComponentOrReplace(this.avatarShape)
    this.eventManager = new EventManager()
    this.eventManager.fireEvent

    // we need this component to filter the interpolator system
    this.transform = this.getComponentOrCreate(Transform)
  }

  loadProfile(profile: NewProfileForRenderer) {
    if (profile) {
      const { avatar } = profile

      const shape = this.avatarShape
      shape.id = profile.userId
      shape.name = profile.name

      shape.bodyShape = avatar.bodyShape
      shape.wearables = avatar.wearables
      shape.skinColor = avatar.skinColor
      shape.hairColor = avatar.hairColor
      shape.eyeColor = avatar.eyeColor
      if (!shape.expressionTriggerId) {
        shape.expressionTriggerId = 'Idle'
        shape.expressionTriggerTimestamp = 0
      }
    }
    this.updateVisibility()
  }

  setVisible(visible: boolean): void {
    if (this.visible != visible) {
      this.visible = visible
    }
    this.updateVisibility()
  }

  setTalking(talking: boolean): void {
    this.avatarShape.talking = talking
  }

  setUserData(userData: Partial<UserInformation>): void {
    if (userData.position) {
      this.setPose(userData.position)
    }
    if (userData.expression) {
      this.setExpression(userData.expression.expressionType, userData.expression.expressionTimestamp)
    }
  }

  setExpression(id: string, timestamp: number): void {
    const shape = this.avatarShape
    shape.expressionTriggerId = id
    shape.expressionTriggerTimestamp = timestamp
  }

  setPose(pose: Pose): void {
    const [x, y, z, Qx, Qy, Qz, Qw, immediate] = pose

    // We re-add the entity to the engine when reposition is immediate to avoid lerping its position in the renderer (and avoid adding a property to the transform for that)
    const shouldReAddEntity = immediate && this.visible

    if (shouldReAddEntity) {
      this.remove()
    }

    this.transform.position.set(x, y, z)
    this.transform.rotation.set(Qx, Qy, Qz, Qw)

    if (shouldReAddEntity) {
      engine.addEntity(this)
    }
  }

  public remove() {
    if (this.isAddedToEngine()) {
      engine.removeEntity(this)
      avatarMap.delete(this.uuid)
    }
  }

  private updateVisibility() {
    if (!this.visible && this.isAddedToEngine()) {
      this.remove()
    } else if (this.visible && !this.isAddedToEngine()) {
      engine.addEntity(this)
    }
  }
}

/**
 * For every UUID, ensures synchronously that an avatar exists in the local state.
 * Returns the AvatarEntity instance
 * @param uuid
 */
function ensureAvatar(uuid: UUID): AvatarEntity {
  let avatar = avatarMap.get(uuid)

  if (avatar) {
    return avatar
  }

  avatar = new AvatarEntity(uuid)
  avatarMap.set(uuid, avatar)

  return avatar
}

function handleUserData({ uuid, data, profile }: ReceiveUserDataMessage): void {
  const avatar = ensureAvatar(uuid)
  avatar.setUserData(data)
  avatar.loadProfile(profile)
}

function handleUserExpression({ uuid, expressionId, timestamp }: ReceiveUserExpressionMessage): void {
  ensureAvatar(uuid).setExpression(expressionId, timestamp)
}

/**
 * In some cases, like minimizing the window, the user will be invisible to the rest of the world.
 * This function handles those visible changes.
 */
function handleUserVisible({ uuid, visible }: ReceiveUserVisibleMessage): void {
  ensureAvatar(uuid).setVisible(visible)
}

function handleUserTalkingUpdate({ uuid, talking }: ReceiveUserTalkingMessage): void {
  ensureAvatar(uuid).setTalking(talking)
}

function handleUserRemoved({ uuid }: UserRemovedMessage): void {
  const avatar = avatarMap.get(uuid)
  if (avatar) {
    avatar.remove()
  }
}

avatarMessageObservable.add((evt) => {
  if (evt.type === AvatarMessageType.USER_DATA) {
    handleUserData(evt)
  } else if (evt.type === AvatarMessageType.USER_VISIBLE) {
    handleUserVisible(evt)
  } else if (evt.type === AvatarMessageType.USER_EXPRESSION) {
    handleUserExpression(evt)
  } else if (evt.type === AvatarMessageType.USER_REMOVED) {
    handleUserRemoved(evt)
  } else if (evt.type === AvatarMessageType.USER_TALKING) {
    handleUserTalkingUpdate(evt as ReceiveUserTalkingMessage)
  }
})
