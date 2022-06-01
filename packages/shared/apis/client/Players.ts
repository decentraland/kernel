import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { UserData } from '../../types'
import { PlayersServiceDefinition } from '../gen/Players'

export async function createPlayersServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, PlayersServiceDefinition>(clientPort, PlayersServiceDefinition)

  return {
    ...realService,
    /**
     * Return the players's data
     */
    async getPlayerData(opt: { userId: string }): Promise<UserData | null> {
      const realResponse = await await realService.realGetPlayerData({ userId: opt.userId })
      if (!realResponse.data) {
        return null
      }
      return {
        ...realResponse.data,
        avatar: {
          ...realResponse.data.avatar!,
          snapshots: realResponse.data.avatar!.snapshots!
        },
        publicKey: realResponse.data.publicKey || null
      }
    },

    /**
     * Return array of connected players
     */
    async getConnectedPlayers(): Promise<{ userId: string }[]> {
      return (await realService.realGetConnectedPlayers({})).players
    },

    /**
     * Return array of players inside the scene
     */
    async getPlayersInScene(): Promise<{ userId: string }[]> {
      return (await realService.realGetPlayersInScene({})).players
    }
  }
}
