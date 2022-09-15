import { Empty } from '../../../renderer-protocol/proto/Teleport.gen'
import { rendererProtocol } from './../../../renderer-protocol/rpcClient'
import { notifyStatusThroughChat } from '../../../shared/chat'
import { changeRealm } from '../../../shared/dao'
import { getUnityInstance } from '../../../unity-interface/IUnityInterface'
import { TeleportController } from '../../../shared/world/TeleportController'
import defaultLogger from '../../../shared/logger'
import { WorldPosition } from '../../../shared/types'

export async function JumpIn(worldPosition: WorldPosition) {
  const {
    gridPosition: { x, y },
    realm: { serverName }
  } = worldPosition

  notifyStatusThroughChat(`Jumping to ${serverName} at ${x},${y}...`)

  changeRealm(serverName).then(
    () => {
      const successMessage = `Jumped to ${x},${y} in realm ${serverName}!`
      notifyStatusThroughChat(successMessage)
      getUnityInstance().ConnectionToRealmSuccess(worldPosition)
      TeleportController.goTo(x, y, successMessage)
    },
    (e) => {
      const cause = e === 'realm-full' ? ' The requested realm is full.' : ''
      notifyStatusThroughChat('changerealm: Could not join realm.' + cause)
      getUnityInstance().ConnectionToRealmFailed(worldPosition)
      defaultLogger.error(e)
    }
  )
}

export function registerTeleportService() {
  rendererProtocol
    .then(async (protocol) => {
      for await (const message of protocol.teleportService.onMessage(Empty)) {
        if (message.jumpIn) {
          await JumpIn({
            gridPosition: { x: message.jumpIn.parcelX, y: message.jumpIn.parcelY },
            realm: { serverName: message.jumpIn.realm, layer: '' }
          })
        } else if (message.teleportTo) {
          const { x, y } = message.teleportTo
          notifyStatusThroughChat(`Jumped to ${x},${y}!`)
          TeleportController.goTo(x, y)
        } else if (message.teleportToCrowd) {
          TeleportController.goToCrowd().catch((e) => defaultLogger.error('error goToCrowd', e))
        } else if (message.teleportToMagic) {
          TeleportController.goToCrowd().catch((e) => defaultLogger.error('error goToCrowd', e))
        }
      }
    })
    .catch((e) => defaultLogger.error('error in registerTeleportService', e))
}
