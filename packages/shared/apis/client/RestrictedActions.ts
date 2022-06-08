import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { RestrictedActionsServiceDefinition } from '../proto/RestrictedActions'

export type PositionType = { x: number; y: number; z: number }

export type Emote = {
  predefined: PredefinedEmote
}

export const enum PredefinedEmote {
  WAVE = 'wave',
  FIST_PUMP = 'fistpump',
  ROBOT = 'robot',
  RAISE_HAND = 'raiseHand',
  CLAP = 'clap',
  MONEY = 'money',
  KISS = 'kiss',
  TIK = 'tik',
  HAMMER = 'hammer',
  TEKTONIK = 'tektonik',
  DONT_SEE = 'dontsee',
  HANDS_AIR = 'handsair',
  SHRUG = 'shrug',
  DISCO = 'disco',
  DAB = 'dab',
  HEAD_EXPLODDE = 'headexplode'
}

export async function createRestrictedActionsServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = await codegen.loadService<Context, RestrictedActionsServiceDefinition>(
    clientPort,
    RestrictedActionsServiceDefinition
  )

  return {
    ...originalService,
    /**
     * move player to a position inside the scene
     *
     * @param position PositionType
     * @param cameraTarget PositionType
     */
    async movePlayerTo(newPosition: PositionType, cameraTarget?: PositionType): Promise<void> {
      await originalService.movePlayerTo({ newRelativePosition: newPosition, cameraTarget: cameraTarget })
    },
    /**
     * trigger an emote on the current player
     *
     * @param emote the emote to perform
     */
    async triggerEmote(emote: Emote): Promise<void> {
      await originalService.triggerEmote({ predefinedEmote: emote.predefined })
    }
  }
}
