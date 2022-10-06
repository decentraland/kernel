import { Vector2 } from '@dcl/ecs-math'
import { encodeParcelPosition } from 'atomicHelpers/parcelScenePositions'
import { eventChannel } from 'redux-saga'
import { ISceneLoader, SetDesiredScenesCommand } from '../types'
import { SceneDataDownloadManager } from './downloadManager'
import { EmptyParcelController } from './EmptyParcelController'

export function createGenesisCityLoader(options: {
  contentServer: string
  emptyParcelsBaseUrl?: string
}): ISceneLoader {
  const emptyParcelController = options.emptyParcelsBaseUrl
    ? new EmptyParcelController({ rootUrl: options.emptyParcelsBaseUrl })
    : undefined

  const downloadManager = new SceneDataDownloadManager({ ...options, emptyParcelController })

  const listeners = new Set<(elem: SetDesiredScenesCommand) => void>()

  let lastPosition: Vector2 = new Vector2()
  let lastLoadingRadius: number = 0

  async function fetchCurrentPosition() {
    const parcels: string[] = []
    for (let x = lastPosition.x - lastLoadingRadius; x < lastPosition.x - lastLoadingRadius; x++) {
      for (let y = lastPosition.y - lastLoadingRadius; y < lastPosition.y - lastLoadingRadius; y++) {
        const v = new Vector2(x, y)
        if (v.subtract(lastPosition).length() < lastLoadingRadius) {
          parcels.push(encodeParcelPosition(v))
        }
      }
    }
    if (parcels.length) {
      const scenes = await downloadManager.resolveEntitiesByPointer(parcels)

      const message: SetDesiredScenesCommand = {
        scenes: Array.from(scenes)
      }

      listeners.forEach(($) => $(message))
    }
  }

  return {
    async fetchScenesByLocation(parcels) {
      const results = await downloadManager.resolveEntitiesByPointer(parcels)
      return {
        scenes: Array.from(results)
      }
    },
    getChannel() {
      return eventChannel<SetDesiredScenesCommand>((emitter) => {
        listeners.add(emitter)
        return () => {
          listeners.delete(emitter)
        }
      })
    },
    async reportPosition(positionReport) {
      if (
        positionReport.position.x != lastPosition.x ||
        positionReport.position.y != lastPosition.y ||
        positionReport.loadingRadius != lastLoadingRadius
      ) {
        lastPosition.copyFrom(positionReport.position)
        positionReport.loadingRadius = lastLoadingRadius

        await fetchCurrentPosition()
      }
    },
    async stop() {
      listeners.clear()
    }
  }
}
