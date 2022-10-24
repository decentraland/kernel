import { getWorld, isInsideWorldLimits } from '@dcl/schemas'

import { countParcelsCloseTo, ParcelArray } from 'shared/comms/interface/utils'
import defaultLogger from 'shared/logger'

import { gridToWorld } from 'atomicHelpers/parcelScenePositions'

import { store } from 'shared/store/isolatedStore'
import { getRealmAdapter } from 'shared/realm/selectors'
import { Parcel } from 'shared/dao/types'
import { urlWithProtocol } from 'shared/realm/resolver'
import { trackTeleportTriggered } from 'shared/loading/types'
import { teleportToAction } from 'shared/scene-loader/actions'
import { getParcelPosition } from 'shared/scene-loader/selectors'
import { getUnityInstance } from 'unity-interface/IUnityInterface'

const descriptiveValidWorldRanges = getWorld()
  .validWorldRanges.map((range) => `(X from ${range.xMin} to ${range.xMax}, and Y from ${range.yMin} to ${range.yMax})`)
  .join(' or ')

// TODO: don't do classes if it holds no state. Use namespaces or functions instead.
export class TeleportController {
  public static async goToCrowd(): Promise<{ message: string; success: boolean }> {
    try {
      let usersParcels = await fetchLayerUsersParcels()

      const currentParcel = getParcelPosition(store.getState())

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
      store.dispatch(trackTeleportTriggered(tpMessage))
      const data = {
        xCoord: x,
        yCoord: y,
        message: teleportMessage
      }
      getUnityInstance().FadeInLoadingHUD(data)

      return { message: tpMessage, success: true }
    } else {
      const errorMessage = `Coordinates are outside of the boundaries. Valid ranges are: ${descriptiveValidWorldRanges}.`
      return { message: errorMessage, success: false }
    }
  }

  public static LoadingHUDReadyForTeleport(data: { x: number; y: number }) {
    store.dispatch(teleportToAction({ position: gridToWorld(data.x, data.y) }))
  }
}

async function fetchLayerUsersParcels(): Promise<ParcelArray[]> {
  const realmAdapter = getRealmAdapter(store.getState())

  try {
    if (realmAdapter) {
      const parcelsResponse = await fetch(`${urlWithProtocol(realmAdapter.baseUrl)}/stats/parcels`)

      if (parcelsResponse.ok) {
        const parcelsBody = await parcelsResponse.json()
        const usersParcels: Parcel[] = []

        if (parcelsBody.parcels) {
          for (const {
            peersCount,
            parcel: { x, y }
          } of parcelsBody.parcels) {
            const parcel: Parcel = [x, y]
            for (let i = 0; i < peersCount; i++) {
              usersParcels.push(parcel)
            }
          }
        }
        return usersParcels
      }
    }
  } catch {}

  return []
}
