import { store } from '../../store/isolatedStore'
import { getCommsIsland } from '../../comms/selectors'
import { getRealmAdapter } from '../../realm/selectors'
import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcServerPort } from '@dcl/rpc/dist/types'
import {
  GetRealmResponse,
  GetTimeResponse,
  RuntimeServiceDefinition
} from '@dcl/protocol/out-ts/decentraland/kernel/apis/runtime.gen'
import { PortContextService } from './context'
import { getDecentralandTime, toEnvironmentRealmType } from './EnvironmentAPI'

export function registerEnvironmentApiServiceServerImplementation(
  port: RpcServerPort<PortContextService<'sceneData'>>
) {
  codegen.registerService(port, RuntimeServiceDefinition, async () => ({
    async getTime(): Promise<GetTimeResponse> {
      const time = getDecentralandTime()

      return { seconds: time }
    },
    async getRealm(): Promise<GetRealmResponse> {
      const realmAdapter = getRealmAdapter(store.getState())
      const island = getCommsIsland(store.getState()) ?? ''

      if (!realmAdapter) {
        return {}
      }

      const realmInfo = toEnvironmentRealmType(realmAdapter, island)

      return {
        currentRealm: {
          domain: realmInfo.domain,
          room: realmInfo.room,
          name: realmInfo.serverName,
          protocol: realmInfo.protocol
        }
      }
    }
  }))
}
