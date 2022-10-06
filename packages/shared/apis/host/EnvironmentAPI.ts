import { getSelectedNetwork } from './../../dao/selectors'
import { getServerConfigurations, PREVIEW, RENDERER_WS } from './../../../config'
import { store } from './../../store/isolatedStore'
import { getCommsIsland, getRealm } from './../../comms/selectors'
import { Realm } from './../../dao/types'
import { getFeatureFlagEnabled } from './../../meta/selectors'
import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import {
  AreUnsafeRequestAllowedResponse,
  BootstrapDataResponse,
  EnvironmentAPIServiceDefinition,
  GetCurrentRealmResponse,
  GetDecentralandTimeResponse,
  GetExplorerConfigurationResponse,
  GetPlatformResponse,
  PreviewModeResponse
} from 'shared/protocol/kernel/apis/EnvironmentAPI.gen'
import { EnvironmentRealm, Platform } from './../IEnvironmentAPI'
import { PortContextService } from './context'
import { transformSerializeOpt } from 'unity-interface/transformSerializationOpt'

export function registerEnvironmentAPIServiceServerImplementation(
  port: RpcServerPort<PortContextService<'sceneData'>>
) {
  codegen.registerService(port, EnvironmentAPIServiceDefinition, async () => ({
    async getBootstrapData(_req, ctx): Promise<BootstrapDataResponse> {
      return {
        id: ctx.sceneData.id,
        baseUrl: ctx.sceneData.baseUrl,
        useFPSThrottling: ctx.sceneData.useFPSThrottling,
        entity: {
          content: ctx.sceneData.entity.content,
          metadataJson: JSON.stringify(ctx.sceneData.entity.metadata)
        }
      }
    },
    async isPreviewMode(): Promise<PreviewModeResponse> {
      return { isPreview: PREVIEW }
    },
    async getPlatform(): Promise<GetPlatformResponse> {
      if (RENDERER_WS) {
        return { platform: Platform.DESKTOP }
      } else {
        return { platform: Platform.BROWSER }
      }
    },
    async areUnsafeRequestAllowed(): Promise<AreUnsafeRequestAllowedResponse> {
      return { status: getFeatureFlagEnabled(store.getState(), 'unsafe-request') }
    },
    async getCurrentRealm(): Promise<GetCurrentRealmResponse> {
      const realm = getRealm(store.getState())
      const island = getCommsIsland(store.getState()) ?? '' // We shouldn't send undefined because it would break contract

      if (!realm) {
        return {}
      }

      return { currentRealm: toEnvironmentRealmType(realm, island) }
    },
    async getExplorerConfiguration(): Promise<GetExplorerConfigurationResponse> {
      return {
        clientUri: location.href,
        configurations: {
          questsServerUrl: getServerConfigurations(getSelectedNetwork(store.getState())).questsUrl,
          enableBinaryTransform: `${transformSerializeOpt.useBinaryTransform}`
        }
      }
    },
    async getDecentralandTime(): Promise<GetDecentralandTimeResponse> {
      let time = decentralandTimeData.time

      // if time is not paused we calculate the current time to avoid
      // constantly receiving messages from the renderer
      if (!decentralandTimeData.isPaused) {
        const offsetMsecs = Date.now() - decentralandTimeData.receivedAt
        const offsetSecs = offsetMsecs / 1000
        const offsetInDecentralandUnits = offsetSecs / decentralandTimeData.timeNormalizationFactor
        time += offsetInDecentralandUnits

        if (time >= decentralandTimeData.cycleTime) {
          time = 0.01
        }
      }

      //convert time to seconds
      time = time * 3600

      return { seconds: time }
    }
  }))
}

export function toEnvironmentRealmType(realm: Realm, island: string | undefined): EnvironmentRealm {
  const { hostname, serverName, protocol } = realm
  return {
    protocol: protocol,
    domain: hostname,
    layer: island ?? '',
    room: island ?? '',
    serverName,
    displayName: serverName
  }
}

type DecentralandTimeData = {
  timeNormalizationFactor: number
  cycleTime: number
  isPaused: number
  time: number
  receivedAt: number
}

let decentralandTimeData: DecentralandTimeData

export function setDecentralandTime(data: DecentralandTimeData) {
  decentralandTimeData = data
  decentralandTimeData.receivedAt = Date.now()
}
