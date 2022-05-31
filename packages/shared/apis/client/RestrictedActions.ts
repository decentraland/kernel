import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { RestrictedActionsServiceDefinition } from '../gen/RestrictedActions'

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
  const realService = await codegen.loadService<Context, RestrictedActionsServiceDefinition>(
    clientPort,
    RestrictedActionsServiceDefinition
  )

  return {
    ...realService,
    /**
     * move player to a position inside the scene
     *
     * @param position PositionType
     * @param cameraTarget PositionType
     */
    async movePlayerTo(newPosition: PositionType, cameraTarget?: PositionType): Promise<void> {
      await realService.realMovePlayerTo({ newRelativePosition: newPosition, cameraTarget: cameraTarget })
    },
    /**
     * trigger an emote on the current player
     *
     * @param emote the emote to perform
     */
    async triggerEmote(emote: Emote): Promise<void> {
      await realService.realTriggerEmote({ predefinedEmote: emote.predefined })
    }
  }
}
