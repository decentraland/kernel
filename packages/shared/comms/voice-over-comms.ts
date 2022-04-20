import { Package, VoiceFragment } from './interface/types'
import { Position, rotateUsingQuaternion } from './interface/utils'
import { store } from 'shared/store/isolatedStore'
import { getCurrentUserProfile, getProfile } from 'shared/profiles/selectors'
import { VoiceCommunicator, VoiceSpatialParams } from 'voice-chat-codec/VoiceCommunicator'
import { getCommsContext, getVoiceCommunicator, getVoicePolicy, isVoiceChatAllowedByCurrentScene } from './selectors'
import { CommsContext } from './context'
import { createLogger } from 'shared/logger'
import { commConfigurations } from 'config'
import Html from 'shared/Html'
import { EncodedFrame } from 'voice-chat-codec/types'
import { setVoiceCommunicator, voicePlayingUpdate, voiceRecordingUpdate } from './actions'
import { put } from 'redux-saga/effects'
import { getBannedUsers } from 'shared/meta/selectors'
import { getIdentity } from 'shared/session'
import { BannedUsers } from 'shared/meta/types'
import { isFriend } from 'shared/friends/selectors'
import { VoicePolicy } from './types'
import { Avatar } from '@dcl/schemas'

const logger = createLogger('VoiceCommunicator: ')

function isVoiceAllowedByPolicy(voiceUserId: string): boolean {
  const policy = getVoicePolicy(store.getState())

  switch (policy) {
    case VoicePolicy.ALLOW_FRIENDS_ONLY:
      return isFriend(store.getState(), voiceUserId)
    case VoicePolicy.ALLOW_VERIFIED_ONLY:
      const theirProfile = getProfile(store.getState(), voiceUserId)
      return !!theirProfile?.hasClaimedName
    default:
      return true
  }
}
export function isBlockedOrBanned(profile: Avatar, bannedUsers: BannedUsers, userId: string): boolean {
  return isBlocked(profile, userId) || isBannedFromChat(bannedUsers, userId)
}

function isBannedFromChat(bannedUsers: BannedUsers, userId: string): boolean {
  const bannedUser = bannedUsers[userId]
  return bannedUser && bannedUser.some((it) => it.type === 'VOICE_CHAT_AND_CHAT' && it.expiration > Date.now())
}

function isBlocked(profile: Avatar, userId: string): boolean {
  return !!profile.blocked && profile.blocked.includes(userId)
}

function isMuted(profile: Avatar, userId: string): boolean {
  return !!profile.muted && profile.muted.includes(userId)
}

function hasBlockedMe(myAddress: string | undefined, theirAddress: string): boolean {
  const profile = getProfile(store.getState(), theirAddress)

  return !!profile && !!myAddress && isBlocked(profile, myAddress)
}

function shouldPlayVoice(profile: Avatar, voiceUserId: string) {
  const myAddress = getIdentity()?.address
  return (
    isVoiceAllowedByPolicy(voiceUserId) &&
    !isBlockedOrBanned(profile, getBannedUsers(store.getState()), voiceUserId) &&
    !isMuted(profile, voiceUserId) &&
    !hasBlockedMe(myAddress, voiceUserId) &&
    isVoiceChatAllowedByCurrentScene()
  )
}

export function processVoiceFragment(context: CommsContext, message: Package<VoiceFragment>) {
  const state = store.getState()
  const voiceCommunicator = getVoiceCommunicator(state)
  const profile = getCurrentUserProfile(state)

  const peerTrackingInfo = context.ensurePeerTrackingInfo(message.sender)

  if (
    profile &&
    peerTrackingInfo.identity &&
    peerTrackingInfo.position &&
    shouldPlayVoice(profile, peerTrackingInfo.identity)
  ) {
    voiceCommunicator
      .playEncodedAudio(peerTrackingInfo.identity, getSpatialParamsFor(peerTrackingInfo.position), message.data)
      .catch((e) => logger.error('Error playing encoded audio!', e))
  }
}

export function setListenerSpatialParams(context: CommsContext) {
  const state = store.getState()
  if (context.currentPosition) {
    getVoiceCommunicator(state).setListenerSpatialParams(getSpatialParamsFor(context.currentPosition))
  }
}

export function getSpatialParamsFor(position: Position): VoiceSpatialParams {
  return {
    position: position.slice(0, 3) as [number, number, number],
    orientation: rotateUsingQuaternion(position, 0, 0, -1)
  }
}

export function* initVoiceCommunicator() {
  logger.info('Initializing VoiceCommunicator')
  const voiceCommunicator = new VoiceCommunicator(
    {
      send(frame: EncodedFrame) {
        const commsContext = getCommsContext(store.getState())

        if (commsContext && commsContext.currentPosition && commsContext.worldInstanceConnection) {
          commsContext.worldInstanceConnection.sendVoiceMessage(commsContext.currentPosition, frame).catch(logger.error)
        }
      }
    },
    {
      initialListenerParams: undefined,
      panningModel: commConfigurations.voiceChatUseHRTF ? 'HRTF' : 'equalpower',
      loopbackAudioElement: Html.loopbackAudioElement()
    }
  )

  voiceCommunicator.addStreamPlayingListener((userId, playing) => {
    store.dispatch(voicePlayingUpdate(userId, playing))
  })

  voiceCommunicator.addStreamRecordingListener((recording) => {
    store.dispatch(voiceRecordingUpdate(recording))
  })
  ;(globalThis as any).__DEBUG_VOICE_COMMUNICATOR = voiceCommunicator

  yield put(setVoiceCommunicator(voiceCommunicator))
}
