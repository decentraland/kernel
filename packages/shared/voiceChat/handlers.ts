import { getCurrentUserProfile } from '../profiles/selectors'
import { Package, VoiceFragment } from '../comms/interface/types'
import { setupPeer } from '../comms/peers'
import { store } from '../store/isolatedStore'
import { getVoiceHandler, shouldPlayVoice } from './selectors'
import { voiceChatLogger } from './context'

export function processVoiceFragment(message: Package<VoiceFragment>) {
  const state = store.getState()
  const voiceHandler = getVoiceHandler(state)
  const profile = getCurrentUserProfile(state)

  const peerTrackingInfo = setupPeer(message.sender)

  if (
    voiceHandler &&
    profile &&
    peerTrackingInfo.ethereumAddress &&
    peerTrackingInfo.position &&
    shouldPlayVoice(state, profile, peerTrackingInfo.ethereumAddress)
  ) {
    voiceHandler
      .playEncodedAudio(peerTrackingInfo.ethereumAddress, peerTrackingInfo.position, message.data)
      .catch((e) => voiceChatLogger.error('Error playing encoded audio!', e))
  }
}
