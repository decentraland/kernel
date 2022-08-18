import {
  REQUEST_TOGGLE_VOICE_CHAT_RECORDING,
  REQUEST_VOICE_CHAT_RECORDING,
  SET_VOICE_CHAT_MUTE,
  SET_VOICE_CHAT_POLICY,
  SET_VOICE_CHAT_VOLUME,
  VoiceChatActions,
  VOICE_RECORDING_UPDATE
} from './actions'
import { VoiceChatState, VoicePolicy } from './types'

const INITIAL_STATE: VoiceChatState = {
  voiceHandler: null,
  recording: false,
  requestRecording: false,
  policy: VoicePolicy.ALLOW_ALL,
  volume: 1.0,
  mute: false
}

export function voiceChatReducer(state?: VoiceChatState, action?: VoiceChatActions): VoiceChatState {
  if (!state) {
    return INITIAL_STATE
  }

  if (!action) {
    return state
  }

  switch (action.type) {
    case SET_VOICE_CHAT_POLICY: {
      const { payload } = action
      return { ...state, volume: payload.policy }
    }
    case REQUEST_VOICE_CHAT_RECORDING: {
      const { payload } = action
      return { ...state, requestRecording: payload.recording }
    }
    case REQUEST_TOGGLE_VOICE_CHAT_RECORDING: {
      return { ...state, requestRecording: !state.requestRecording }
    }
    case SET_VOICE_CHAT_VOLUME: {
      const { payload } = action
      return { ...state, volume: payload.volume }
    }
    case SET_VOICE_CHAT_MUTE: {
      const { payload } = action
      return { ...state, mute: payload.mute }
    }
    case VOICE_RECORDING_UPDATE: {
      const { payload } = action
      return { ...state, recording: payload.recording }
    }
  }

  return state
}
