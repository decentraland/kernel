import { getPerformanceInfo } from '../session/getPerformanceInfo'

export type PositionTrackEvents = {
  ['Scene Spawn']: { parcel: string; spawnpoint: ReadOnlyVector3 }
}

export type TrackEvents = PositionTrackEvents & {
  // Comms Events
  ['Comms Status v2']: Record<string, any>

  // Info logs, such as networks or things we want to track
  ['SNAPSHOT_IMAGE_NOT_FOUND']: { userId: string }
  ['fetchWearablesFromCatalyst_failed']: { wearableId: string }
  ['avatar_edit_success']: { userId: string; version: number; wearables: string[] }
  ['referral_save']: { code: string; address?: string; referral_of?: unknown }
  ['Move to Parcel']: { newParcel: string; oldParcel: string | null; exactPosition: ReadOnlyVector3 }
  ['motd_failed']: Record<string, unknown> // {}
  ['TermsOfServiceResponse']: { sceneId: string; accepted: boolean; dontShowAgain: boolean }
  ['error']: { context: string; message: string; stack: string; saga_stack?: string }
  ['error_fatal']: { context: string; message: string; stack: string; saga_stack?: string }
  ['long_chat_message_ignored']: { message: string; sender?: string }
  ['renderer_initialization_error']: { message: string }

  // Performance
  ['scene_loading_failed']: {
    sceneId: string
    contentServer: string
    catalystServer: string
    contentServerBundles: string
    rootUrl: string
  }
  ['SceneLoadTimes']: {
    position: ReadOnlyVector3
    elapsed: number
    success: boolean
    sceneId: string
    userId: string
  }
  ['renderer_initializing_start']: Record<string, unknown> // {}
  ['renderer_initializing_end']: { loading_time: number }
  ['renderer_set_threw']: { object: string; method: string; payload: string; stack: string }
  ['lifecycle event']: { stage: string; retries?: unknown }
  ['performance report']: ReturnType<typeof getPerformanceInfo>
  ['system info report']: {
    graphicsDeviceName: string
    graphicsDeviceVersion: string
    graphicsMemorySize: number
    processorType: string
    processorCount: number
    systemMemorySize: number
  }
  ['unity_loader_downloading_start']: { renderer_version: string }
  ['unity_loader_downloading_end']: { renderer_version: string; loading_time: number }
  ['unity_downloading_start']: { renderer_version: string }
  ['unity_downloading_end']: { renderer_version: string; loading_time: number }
  ['unity_initializing_start']: { renderer_version: string }
  ['unity_initializing_end']: { renderer_version: string; loading_time: number }
  ['scene_start_event']: { scene_id: string; time_since_creation: number }
  ['invalid_schema']: { schema: string; payload: any }
}
