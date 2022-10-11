import * as sinon from 'sinon'
import { expect } from 'chai'
import * as peers from '../../packages/shared/comms/peers'
import { getVisibleAvatarsUserId } from '../../packages/shared/sceneEvents/visibleAvatars'
import { AvatarMessageType } from '../../packages/shared/comms/interface/types'
import * as sceneManager from '../../packages/shared/world/parcelSceneManager'
import { buildStore } from 'shared/store/store'
import { Color3 } from '@dcl/ecs-math'

function prepareAvatar(address: string) {
  peers.receivePeerUserData(
    {
      ethAddress: address,
      hasClaimedName: false,
      name: address,
      version: 1,
      description: address,
      tutorialStep: 0,
      userId: address,
      avatar: {
        bodyShape: 'body',
        wearables: [],
        emotes: [],
        eyes: { color: Color3.Green() },
        hair: { color: Color3.Green() },
        skin: { color: Color3.Green() },
        snapshots: {
          body: 'body',
          face256: 'face256'
        }
      }
    },
    location.origin
  )
  peers.receiveUserVisible(address, false)
}

function removeAvatarMessage(userId: string) {
  peers.avatarMessageObservable.notifyObservers({
    type: AvatarMessageType.USER_REMOVED,
    userId
  })
}

function mockGetUser() {
  sinon.stub(peers, 'getPeer').callsFake((userId: string) => ({ userId } as any))
}

let sceneEventsMocked

describe('Avatar observable', () => {
  const userA = '0xa00000000000000000000000000000000000000a'
  const userB = '0xb00000000000000000000000000000000000000b'
  const userC = '0xc00000000000000000000000000000000000000c'

  beforeEach('start store', () => {
    const { store } = buildStore()
    globalThis.globalStore = store

    prepareAvatar(userA)
    prepareAvatar(userB)
    prepareAvatar(userC)

    mockGetUser()
    sceneEventsMocked = sinon.stub(sceneManager, 'allScenesEvent')
  })

  afterEach(() => {
    // clear visible avatars cache
    const users = getVisibleAvatarsUserId()
    users.forEach((u) => peers.receiveUserVisible(u, false))

    sinon.restore()
    sinon.reset()
  })

  it('should return user A and B that are visible at the scene', () => {
    peers.receiveUserVisible(userA, true)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerConnected', payload: { userId: userA } })

    peers.receiveUserVisible(userB, true)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerConnected', payload: { userId: userB } })
    sceneEventsMocked.reset()

    peers.receiveUserVisible(userC, false)
    sinon.assert.notCalled(sceneEventsMocked)
    expect(getVisibleAvatarsUserId()).to.eql([userA, userB])
  })

  it('if should remove user when he leaves the scene', () => {
    peers.receiveUserVisible(userA, true)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerConnected', payload: { userId: userA } })

    peers.receiveUserVisible(userB, true)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerConnected', payload: { userId: userB } })
    expect(getVisibleAvatarsUserId()).to.eql([userA, userB])

    peers.receiveUserVisible(userA, false)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerDisconnected', payload: { userId: userA } })
    expect(getVisibleAvatarsUserId()).to.eql([userB])
  })

  it('should remove the user from the cache if we receieve an USER_REMOVED action', () => {
    peers.receiveUserVisible(userA, true)
    peers.receiveUserVisible(userB, true)
    expect(getVisibleAvatarsUserId()).to.eql([userA, userB])
    removeAvatarMessage(userA)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerDisconnected', payload: { userId: userA } })
    expect(getVisibleAvatarsUserId()).to.eql([userB])
  })
})
