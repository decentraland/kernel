import { parcelLimits } from 'config'
import { isInsideWorldLimits } from '@dcl/schemas'

import { lastPlayerPosition, teleportObservable } from 'shared/world/positionThings'
import { countParcelsCloseTo, ParcelArray } from 'shared/comms/interface/utils'
import defaultLogger from 'shared/logger'

import { worldToGrid } from 'atomicHelpers/parcelScenePositions'

import { getCommsServer } from 'shared/dao/selectors'
import { store } from 'shared/store/isolatedStore'
import { getCommsContext } from 'shared/comms/selectors'

// TODO: don't do classess if it holds no state. Use namespaces or functions instead.
export class TeleportController {
  public static async goToCrowd(): Promise<{ message: string; success: boolean }> {
    try {
      let usersParcels = await fetchLayerUsersParcels()

      const currentParcel = worldToGrid(lastPlayerPosition)

      usersParcels = usersParcels.filter(
        (it) => isInsideWorldLimits(it[0], it[1]) && currentParcel.x !== it[0] && currentParcel.y !== it[1]
      )

      if (usersParcels.length > 0) {
        // Sorting from most close users
        const [target, closeUsers] = usersParcels
          .map((it) => [it, countParcelsCloseTo(it, usersParcels)] as [ParcelArray, number])
          .sort(([_, score1], [__, score2]) => score2 - score1)[0]

        return TeleportController.goTo(
          target[0],
          target[1],
          `Found a parcel with ${closeUsers} user(s) nearby: ${target[0]},${target[1]}. Teleporting...`
        )
      } else {
        return {
          message: 'There seems to be no users in other parcels at the current realm. Could not teleport.',
          success: false
        }
      }
    } catch (e) {
      defaultLogger.error('Error while trying to teleport to crowd', e)
      return {
        message: 'Could not teleport to crowd! Could not get information about other users in the realm',
        success: false
      }
    }
  }

  public static goToRandom(): { message: string; success: boolean } {
    const x = Math.floor(Math.random() * 301) - 150
    const y = Math.floor(Math.random() * 301) - 150
    const tpMessage = `Teleporting to random location (${x}, ${y})...`
    return TeleportController.goTo(x, y, tpMessage)
  }

  public static goTo(x: number, y: number, teleportMessage?: string): { message: string; success: boolean } {
    const tpMessage: string = teleportMessage ? teleportMessage : `Teleporting to ${x}, ${y}...`

    if (isInsideWorldLimits(x, y)) {
      teleportObservable.notifyObservers({
        x: x,
        y: y,
        text: tpMessage
      })

      return { message: tpMessage, success: true }
    } else {
      const errorMessage = `Coordinates are outside of the boundaries. Valid ranges are: ${parcelLimits.descriptiveValidWorldRanges}.`
      return { message: errorMessage, success: false }
    }
  }
}

async function fetchLayerUsersParcels(): Promise<ParcelArray[]> {
  const context = getCommsContext(store.getState())

  try {
    if (context) {
      const commsStatusResponse = await fetch(
        `${getCommsServer(context.realm.hostname)}/status?includeUsersParcels=true`
      )
      if (commsStatusResponse.ok) {
        const layerUsers = await commsStatusResponse.json()
        return layerUsers.usersParcels
      }
    }
  } catch {}

  return []
}
