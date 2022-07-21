import { Realm } from 'shared/dao/types'
import { isFeatureToggleEnabled } from 'shared/selectors'
import { VOICE_CHAT_FEATURE_TOGGLE } from 'shared/types'
import { lastPlayerScene } from 'shared/world/sceneState'
import type { VoiceCommunicator } from 'voice-chat-codec/VoiceCommunicator'
import type { CommsContext } from './context'
import { RootCommsState } from './types'

export const isVoiceChatRecording = (store: RootCommsState) => store.comms.voiceChatRecording
export const getVoicePolicy = (store: RootCommsState) => store.comms.voicePolicy
export const getCommsIsland = (store: RootCommsState): string | undefined => store.comms.island
export const getRealm = (store: RootCommsState): Realm | undefined => store.comms.context?.realm
export const getCommsContext = (state: RootCommsState): CommsContext | undefined => state.comms.context
export const getVoiceCommunicator = (store: RootCommsState): VoiceCommunicator | undefined => {
  return store.comms.voiceCommunicator
}

export function isVoiceChatAllowedByCurrentScene() {
  return isFeatureToggleEnabled(VOICE_CHAT_FEATURE_TOGGLE, lastPlayerScene?.entity.metadata)
}

export function sameRealm(realm1: Realm, realm2: Realm) {
  return (
    realm1.protocol === realm2.protocol &&
    realm1.hostname === realm2.hostname &&
    realm1.serverName === realm2.serverName
  )
}
