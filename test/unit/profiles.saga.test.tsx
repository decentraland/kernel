import { expectSaga } from 'redux-saga-test-plan'
import { call, select } from 'redux-saga/effects'
import * as matchers from 'redux-saga-test-plan/matchers'
import { profileRequest, profileSuccess } from 'shared/profiles/actions'
import { handleFetchProfile, profileServerRequest } from 'shared/profiles/sagas'
import { getCurrentUserId } from 'shared/session/selectors'
import { profileSaga } from '../../packages/shared/profiles/sagas'
import { processServerProfile } from '../../packages/shared/profiles/transformations/processServerProfile'
import { dynamic } from 'redux-saga-test-plan/providers'
import { expect } from 'chai'
import { PROFILE_SUCCESS } from '../../packages/shared/profiles/actions'
import { sleep } from 'atomicHelpers/sleep'
import { getRealm } from 'shared/comms/selectors'
import { Avatar } from '@dcl/schemas'
import { ensureAvatarCompatibilityFormat } from 'shared/profiles/transformations/profileToServerFormat'

const profile: Avatar = { data: 'profile' } as any

function delayed<T>(result: T) {
  return dynamic<T>(async () => {
    await sleep(1)
    return result
  })
}

const delayedProfile = delayed({ avatars: [profile] })

describe('fetchProfile behavior', () => {
  it('avatar compatibility format', () => {
    ensureAvatarCompatibilityFormat({
      avatar: {
        "bodyShape": "urn:decentraland:off-chain:base-avatars:BaseMale",
        "wearables": [
          "urn:decentraland:off-chain:base-avatars:eyes_00",
          "urn:decentraland:off-chain:base-avatars:eyebrows_00",
          "urn:decentraland:off-chain:base-avatars:mouth_00",
          "urn:decentraland:off-chain:base-avatars:casual_hair_01",
          "urn:decentraland:off-chain:base-avatars:beard",
          "urn:decentraland:off-chain:base-avatars:green_hoodie",
          "urn:decentraland:off-chain:base-avatars:brown_pants",
          "urn:decentraland:off-chain:base-avatars:sneakers"
        ],
        "snapshots": {
          "face256": "/images/avatar_snapshot_default256.png",
          "body": "/images/image_not_found.png"
        }
      }
    } as any)

  })


  it.skip('completes once for more than one request of same user',
    () => {
      return expectSaga(profileSaga)
        .put(profileSuccess('user|1', 'passport' as any, true))
        .not.put(profileSuccess('user|1', 'passport' as any, true))
        .dispatch(profileRequest('user|1'))
        .dispatch(profileRequest('user|1'))
        .dispatch(profileRequest('user|1'))
        .provide([
          [select(getRealm), {}],
          [call(profileServerRequest, 'user|1'), delayedProfile],
          [select(getCurrentUserId), 'myid'],
          [call(processServerProfile, 'user|1', profile), 'passport']
        ])
        .run()
    })

  it.skip('runs one request for each user', () => {
    return expectSaga(profileSaga)
      .put(profileSuccess('user|1', 'passport1' as any, true))
      .put(profileSuccess('user|2', 'passport2' as any, true))
      .not.put(profileSuccess('user|1', 'passport1' as any))
      .not.put(profileSuccess('user|2', 'passport2' as any))
      .dispatch(profileRequest('user|1'))
      .dispatch(profileRequest('user|1'))
      .dispatch(profileRequest('user|2'))
      .dispatch(profileRequest('user|2'))
      .provide([
        [select(getRealm), {}],
        [call(profileServerRequest, 'user|1'), delayedProfile],
        [select(getCurrentUserId), 'myid'],
        [call(processServerProfile, 'user|1', profile), 'passport1'],
        [call(profileServerRequest, 'user|2'), delayedProfile],
        [call(processServerProfile, 'user|2', profile), 'passport2']
      ])
      .run()
  })


  it.skip('detects and fixes corrupted scaled snapshots', () => {
    const profileWithCorruptedSnapshots = {
      avatar: { snapshots: { face: 'http://fake.url/contents/facehash', face128: '128', face256: '256' } }
    }
    const profile1 = { ...profileWithCorruptedSnapshots, ethAddress: 'eth1' }
    return expectSaga(handleFetchProfile, profileRequest('user|1'))
      .provide([
        [select(getCurrentUserId), 'myid'],
        // [select(getResizeService), 'http://fake/resizeurl'],
        [matchers.call.fn(fetch), dynamic(() => ({ ok: true }))],
        [call(profileServerRequest, 'user|1'), delayed({ avatars: [profile1] })],
        // [call(processServerProfile, 'user|1', profile1), dynamic((effect) => effect.args[1])]
      ])
      .run()
      .then((result) => {
        const putEffects = result.effects.put
        const lastPut = putEffects[putEffects.length - 1].payload.action
        expect(lastPut.type).to.eq(PROFILE_SUCCESS)

        const { face, face128, face256 } = lastPut.payload.profile.avatar.snapshots
        expect(face).to.eq('http://fake.url/contents/facehash')
        expect(face128).to.eq('http://fake/resizeurl/facehash/128')
        expect(face256).to.eq('http://fake/resizeurl/facehash/256')
      })
  })

  it.skip('falls back when resize not working in current server', () => {
    const profileWithCorruptedSnapshots = {
      avatar: { snapshots: { face256: 'http://fake.url/contents/facehash' } }
    }
    const profile1 = { ...profileWithCorruptedSnapshots, ethAddress: 'eth1' }
    return expectSaga(handleFetchProfile, profileRequest('user|1'))
      .provide([
        [select(getCurrentUserId), 'myid'],
        // [select(getResizeService), 'http://fake/resizeurl'],
        [matchers.call.fn(fetch), dynamic((call) => ({ ok: !call.args[0].startsWith('http://fake/resizeurl') }))],
        [call(profileServerRequest, 'user|1'), delayed({ avatars: [profile1] })],
        // [call(processServerProfile, 'user|1', profile1), dynamic((effect) => effect.args[1])]
      ])
      .run()
      .then((result) => {
        const putEffects = result.effects.put
        const lastPut = putEffects[putEffects.length - 1].payload.action
        expect(lastPut.type).to.eq(PROFILE_SUCCESS)

        // const { face, face128, face256 } = lastPut.payload.profile.avatar.snapshots
        // expect(face).to.eq('http://fake.url/contents/facehash')
        // expect(face128).to.eq(
        //   `${getServerConfigurations(ETHEREUM_NETWORK.MAINNET).fallbackResizeServiceUrl}/facehash/128`
        // )
        // expect(face256).to.eq(
        //   `${getServerConfigurations(ETHEREUM_NETWORK.MAINNET).fallbackResizeServiceUrl}/facehash/256`
        // )
      })
  })
})
