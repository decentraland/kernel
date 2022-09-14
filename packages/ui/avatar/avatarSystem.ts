import {
  AvatarShape,
  engine,
  Entity,
  Observable,
  Transform,
  EventManager
  // BoxShape,
  // IEntity,
  // Material,
  // Color4
} from '@dcl/legacy-ecs'
import type {
  AvatarMessage,
  Pose,
  ReceiveUserDataMessage,
  ReceiveUserExpressionMessage,
  ReceiveUserTalkingMessage,
  ReceiveUserVisibleMessage,
  UserInformation,
  UserRemovedMessage,
  UUID
} from 'shared/comms/interface/types'
import { NewProfileForRenderer } from 'shared/profiles/transformations/types'
export const avatarMessageObservable = new Observable<AvatarMessage>()

const avatarMap = new Map<string, AvatarEntity>()
// const box = new BoxShape()
// const red = new Material()
// red.albedoColor = new Color4(1.0, 0.0, 0.0, 1.0)
// const green = new Material()
// green.albedoColor = new Color4(0.0, 1.0, 0.0, 1.0)

export class AvatarEntity extends Entity {
  visible = true

  transform: Transform
  avatarShape!: AvatarShape

  // sub: IEntity

  constructor(public readonly userId: string, avatarShape = new AvatarShape()) {
    super()
    this.avatarShape = avatarShape
    this.avatarShape.useDummyModel = true

    this.addComponentOrReplace(this.avatarShape)
    this.eventManager = new EventManager()
    this.eventManager.fireEvent

    // we need this component to filter the interpolator system
    this.transform = this.getComponentOrCreate(Transform)

    // this.sub = new Entity()
    // engine.addEntity(this.sub)
    // this.sub.addComponent(box)
    // this.sub.addComponent(this.transform)
    // this.sub.addComponentOrReplace(red)
  }

  loadProfile(profile: Pick<NewProfileForRenderer, 'avatar' | 'name'>) {
    if (profile && profile.name && profile.avatar.bodyShape) {
      // this.sub.addComponentOrReplace(green)
      const { avatar } = profile

      const shape = this.avatarShape
      shape.id = this.userId
      shape.name = profile.name

      this.avatarShape.useDummyModel = false

      shape.bodyShape = avatar.bodyShape
      shape.wearables = avatar.wearables
      shape.emotes = profile.avatar.emotes

      shape.skinColor = avatar.skinColor
      shape.hairColor = avatar.hairColor
      shape.eyeColor = avatar.eyeColor
      if (!shape.expressionTriggerId) {
        shape.expressionTriggerId = 'Idle'
        shape.expressionTriggerTimestamp = 0
      }
    } else {
      this.avatarShape.useDummyModel = true
      // this.sub.addComponentOrReplace(red)
    }
    this.updateVisibility()
  }

  setVisible(visible: boolean): void {
    if (this.visible !== visible) {
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
    }
    // if (this.sub.isAddedToEngine()) engine.removeEntity(this.sub)
  }

  private updateVisibility() {
    if (!this.visible && this.isAddedToEngine()) {
      this.remove()
    } else if (this.visible && !this.isAddedToEngine()) {
      engine.addEntity(this)
      // engine.addEntity(this.sub)
    }
  }
}

/**
 * For every UUID, ensures synchronously that an avatar exists in the local state.
 * Returns the AvatarEntity instance
 * @param userId
 */
function ensureAvatar(userId: UUID): AvatarEntity {
  let avatar = avatarMap.get(userId)

  if (avatar) {
    return avatar
  }

  avatar = new AvatarEntity(userId)
  avatarMap.set(userId, avatar)

  return avatar
}

function handleUserData({ userId, data, profile }: ReceiveUserDataMessage): void {
  const avatar = ensureAvatar(userId)
  avatar.setUserData(data)
  avatar.loadProfile(profile)
  avatar.setVisible(data.visible ?? true)
}

function handleUserExpression({ userId, expressionId, timestamp }: ReceiveUserExpressionMessage): void {
  ensureAvatar(userId).setExpression(expressionId, timestamp)
}

/**
 * In some cases, like minimizing the window, the user will be invisible to the rest of the world.
 * This function handles those visible changes.
 */
function handleUserVisible({ userId, visible }: ReceiveUserVisibleMessage): void {
  ensureAvatar(userId).setVisible(visible)
}

function handleUserTalkingUpdate({ userId, talking }: ReceiveUserTalkingMessage): void {
  ensureAvatar(userId).setTalking(talking)
}

function handleUserRemoved({ userId }: UserRemovedMessage): void {
  const avatar = avatarMap.get(userId)
  if (avatar) {
    // avatar.transform.translate(new Vector3(0, 100, 0))
    // setTimeout(() => {
    avatar.remove()
    // }, 2000)
    avatarMap.delete(userId)
  }
}

avatarMessageObservable.add((evt) => {
  if (evt.type === 'USER_DATA') {
    handleUserData(evt)
  } else if (evt.type === 'USER_VISIBLE') {
    handleUserVisible(evt)
  } else if (evt.type === 'USER_EXPRESSION') {
    handleUserExpression(evt)
  } else if (evt.type === 'USER_REMOVED') {
    handleUserRemoved(evt)
  } else if (evt.type === 'USER_TALKING') {
    handleUserTalkingUpdate(evt as ReceiveUserTalkingMessage)
  }
})
