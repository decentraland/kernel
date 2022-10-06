import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { UserData } from '../../types'
import { PlayersServiceDefinition } from 'shared/protocol/kernel/apis/Players.gen'

export namespace PlayersServiceClient {
  export function create<Context>(clientPort: RpcClientPort) {
    return codegen.loadService<Context, PlayersServiceDefinition>(clientPort, PlayersServiceDefinition)
  }

  export function createLegacy<Context>(clientPort: RpcClientPort) {
    const originalService = codegen.loadService<Context, PlayersServiceDefinition>(clientPort, PlayersServiceDefinition)

    return {
      ...originalService,
      /**
       * Return the players's data
       */
      async getPlayerData(opt: { userId: string }): Promise<UserData | null> {
        const originalResponse = await originalService.getPlayerData({ userId: opt.userId })
        if (!originalResponse.data) {
          return null
        }
        return {
          ...originalResponse.data,
          avatar: {
            ...originalResponse.data.avatar!,
            snapshots: originalResponse.data.avatar!.snapshots!
          },
          publicKey: originalResponse.data.publicKey || null
        }
      },

      /**
       * Return array of connected players
       */
      async getConnectedPlayers(): Promise<{ userId: string }[]> {
        return (await originalService.getConnectedPlayers({})).players
      },

      /**
       * Return array of players inside the scene
       */
      async getPlayersInScene(): Promise<{ userId: string }[]> {
        return (await originalService.getPlayersInScene({})).players
      }
    }
  }
}
