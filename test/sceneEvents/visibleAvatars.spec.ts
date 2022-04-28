import * as sinon from 'sinon'
import { expect } from 'chai'
import * as peers from '../../packages/shared/comms/peers'
import { getVisibleAvatarsUserId } from '../../packages/shared/sceneEvents/visibleAvatars'
import { AvatarMessageType } from '../../packages/shared/comms/interface/types'
import * as sceneManager from '../../packages/shared/world/parcelSceneManager'
import { buildStore } from 'shared/store/store'

function sendAvatarMessage(userId: string, visible: boolean, removeInfo: boolean = false) {
  peers.setupPeer(userId).ethereumAddress = removeInfo ? undefined : userId
  peers.receiveUserVisible(userId, visible)
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
  beforeEach('start store', () => {
    const { store } = buildStore()
    globalThis.globalStore = store

    mockGetUser()
    sceneEventsMocked = sinon.stub(sceneManager, 'allScenesEvent')
  })

  afterEach(() => {
    // clear visible avatars cache
    const users = getVisibleAvatarsUserId()
    users.forEach((u) => sendAvatarMessage(u, false))

    sinon.restore()
    sinon.reset()
  })
  it('should return user A and B that are visible at the scene', () => {
    const userA = 'user-a'
    const userB = 'user-b'
    const userC = 'user-c'

    sendAvatarMessage(userA, true)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerConnected', payload: { userId: userA } })

    sendAvatarMessage(userB, true)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerConnected', payload: { userId: userB } })
    sceneEventsMocked.reset()

    sendAvatarMessage(userC, false)
    sinon.assert.notCalled(sceneEventsMocked)
    expect(getVisibleAvatarsUserId()).to.eql([userA, userB])
  })

  it('if should remove user when he leaves the scene', () => {
    const userA = 'user-a'
    const userB = 'user-b'

    sendAvatarMessage(userA, true)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerConnected', payload: { userId: userA } })

    sendAvatarMessage(userB, true)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerConnected', payload: { userId: userB } })
    expect(getVisibleAvatarsUserId()).to.eql([userA, userB])

    sendAvatarMessage(userA, false)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerDisconnected', payload: { userId: userA } })
    expect(getVisibleAvatarsUserId()).to.eql([userB])
  })

  it('should not add the users if there is not info about them. Race cond', () => {
    sinon.restore()
    const userA = 'user-a'
    removeAvatarMessage(userA)
    sendAvatarMessage(userA, true, true)
    expect(getVisibleAvatarsUserId()).to.eql([])
    sinon.assert.notCalled(sceneEventsMocked)
  })

  it('should remove the user from the cache if we receieve an USER_REMOVED action', () => {
    const userA = 'user-a'
    const userB = 'user-b'
    sendAvatarMessage(userA, true)
    sendAvatarMessage(userB, true)
    expect(getVisibleAvatarsUserId()).to.eql([userA, userB])
    removeAvatarMessage(userA)
    sinon.assert.calledWith(sceneEventsMocked, { eventType: 'playerDisconnected', payload: { userId: userA } })
    expect(getVisibleAvatarsUserId()).to.eql([userB])
  })
})
