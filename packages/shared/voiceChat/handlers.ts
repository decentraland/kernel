import { getCurrentUserProfile } from '../profiles/selectors'
import { Package, VoiceFragment } from '../comms/interface/types'
import { getPeer } from '../comms/peers'
import { store } from '../store/isolatedStore'
import { getVoiceHandler, shouldPlayVoice } from './selectors'
import { voiceChatLogger } from './context'
import { trackEvent } from 'shared/analytics'

export function processVoiceFragment(message: Package<VoiceFragment>) {
  const state = store.getState()
  const voiceHandler = getVoiceHandler(state)
  const profile = getCurrentUserProfile(state)

  // use getPeed instead of setupPeer to only reproduce voice messages from
  // known avatars
  const peerTrackingInfo = getPeer(message.sender)

  if (
    voiceHandler &&
    profile &&
    peerTrackingInfo &&
    peerTrackingInfo.ethereumAddress &&
    peerTrackingInfo.position &&
    shouldPlayVoice(state, profile, peerTrackingInfo.ethereumAddress)
  ) {
    voiceHandler
      .playEncodedAudio(peerTrackingInfo.ethereumAddress, peerTrackingInfo.position, message.data)
      .catch((e: any) => {
        trackEvent('error', {
          context: 'voice-chat',
          message: e.message,
          stack: ''
        })
        voiceChatLogger.error('Error playing encoded audio!', e)
      })
  }
}
