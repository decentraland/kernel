import { VoiceState } from './types'
import {
  ADD_REMOTE_STREAM,
  RECONNECT_VOICE,
  REMOVE_REMOTE_STREAM,
  SET_LOCAL_STREAM,
  VoiceActions,
  VOICE_INITIALIZED
} from './actions'

const VOICE_INITIAL_STATE: VoiceState = {
  connected: false,
  remoteStreams: [],
  localStream: undefined,
  reconnectTimes: 0
}

type State = VoiceState

export function voiceReducer(
  state: VoiceState = VOICE_INITIAL_STATE,
  action: VoiceActions
): State {
  switch (action.type) {
    case VOICE_INITIALIZED: {
      return {
        ...state,
        client: action.payload.client,
        signal: action.payload.signal,
        connected: true,
        reconnectTimes: 0,
        remoteStreams: []
      }
    }

    case RECONNECT_VOICE: {
      return {
        ...state,
        reconnectTimes: state.reconnectTimes + 1
      }
    }

    case ADD_REMOTE_STREAM: {
      const { stream } = action.payload
      if (state.remoteStreams.find(s => s.id === stream.id)) {
        return {
          ...state,
          remoteStreams: state.remoteStreams.map(s => s.id === stream.id ? stream : s)
        }
      }

      return {
        ...state,
        remoteStreams: state.remoteStreams.concat(stream)
      }
    }

    case REMOVE_REMOTE_STREAM: {
      return {
        ...state,
        remoteStreams: state.remoteStreams.filter(stream => stream.id !== action.payload.streamId)
      }
    }

    case SET_LOCAL_STREAM: {
      return {
        ...state,
        localStream: action.payload.stream
      }
    }

  }

  return state
}
