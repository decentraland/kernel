// import { expect } from 'chai'
import { buildStore } from 'shared/store/store'
import { GetFriendsPayload } from 'shared/types'
import sinon from 'sinon'
import * as friendsSagas from '../../packages/shared/friends/sagas'
import * as friendsSelectors from 'shared/friends/selectors'
import * as profilesSelectors from 'shared/profiles/selectors'
import { ProfileUserInfo } from 'shared/profiles/types'
import { getUnityInstance } from '../../packages/unity-interface/IUnityInterface'
import { profileToRendererFormat } from 'shared/profiles/transformations/profileToRendererFormat'
// import { profileToRendererFormat } from 'shared/profiles/transformations/profileToRendererFormat'
// import Sinon from 'sinon'

function getMockedAvatar(userId: string, name: string): ProfileUserInfo {
  return {
    data: {
      avatar: {
        snapshots: {
          face256: '',
          body: ''
        },
        eyes: { color: '' },
        hair: { color: '' },
        skin: { color: '' }
      } as any,
      description: '',
      ethAddress: userId,
      hasClaimedName: false,
      name,
      tutorialStep: 1,
      userId: userId,
      version: 1
    },
    status: 'ok'
  }
}

const friendIds = ['0xa1', '0xb1', '0xc1', '0xd1']

const profilesFromStore = [
  getMockedAvatar('0xa1', 'john'),
  getMockedAvatar('0xa2', 'mike'),
  getMockedAvatar('0xc1', 'agus'),
  getMockedAvatar('0xd1', 'boris')
]

function mockStoreCalls() {
  sinon.stub(friendsSelectors, 'getPrivateMessagingFriends').callsFake(() => friendIds)
  sinon.stub(profilesSelectors, 'getProfilesFromStore').callsFake(() => profilesFromStore)
}

describe('Friends sagas', () => {
  sinon.mock()

  describe('get friends', () => {
    beforeEach(() => {
      const { store } = buildStore()
      globalThis.globalStore = store

      mockStoreCalls()
    })

    afterEach(() => {
      sinon.restore()
      sinon.reset()
    })

    describe("When there's a filter by id", () => {
      it('Should filter the responses to have only the ones that include the userId', () => {
        const request: GetFriendsPayload = {
          limit: 1000,
          skip: 0,
          userNameOrId: '0xa'
        }
        const expectedFriends = [
          profileToRendererFormat(profilesFromStore[0].data, {}),
          profileToRendererFormat(profilesFromStore[1].data, {})
        ]
        const addedFriends = {
          friends: expectedFriends.map((friend) => friend.userId),
          totalFriends: 2
        }
        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriends').once().withExactArgs(addedFriends)
        friendsSagas.getFriends(request)
        sinon.verify()
      })
    })

    describe("When there's a filter by name", () => {
      it('Should filter the responses to have only the ones that include the user name', () => {
        const request2: GetFriendsPayload = {
          limit: 1000,
          skip: 0,
          userNameOrId: 'MiKe'
        }
        const expectedFriends = [profileToRendererFormat(profilesFromStore[1].data, {})]
        const addedFriends = {
          friends: expectedFriends.map((friend) => friend.userId),
          totalFriends: 1
        }
        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriends').once().withExactArgs(addedFriends)
        friendsSagas.getFriends(request2)
        sinon.verify()
      })
    })

    describe("When there's a skip", () => {
      it('Should filter the responses to skip the expected amount', () => {
        const request2: GetFriendsPayload = {
          limit: 1000,
          skip: 1
        }
        const expectedFriends = profilesFromStore.slice(1).map((profile) => profileToRendererFormat(profile.data, {}))
        const addedFriends = {
          friends: expectedFriends.map((friend) => friend.userId),
          totalFriends: 4
        }
        sinon.mock(getUnityInstance()).expects('AddUserProfilesToCatalog').once().withExactArgs(expectedFriends)
        sinon.mock(getUnityInstance()).expects('AddFriends').once().withExactArgs(addedFriends)
        friendsSagas.getFriends(request2)
        sinon.verify()
      })
    })
  })
})
