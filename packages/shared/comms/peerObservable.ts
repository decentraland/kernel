import { encodeParcelPosition, isWorldPositionInsideParcels, worldToGrid } from 'atomicHelpers/parcelScenePositions'
import { ReadOnlyVector3, Observable } from 'decentraland-ecs'
import { fetchSceneIds } from 'decentraland-loader/lifecycle/utils/fetchSceneIds'
import { fetchSceneJson } from 'decentraland-loader/lifecycle/utils/fetchSceneJson'
import { ILand } from 'shared/types'
import { getSceneWorkerBySceneID } from 'shared/world/parcelSceneManager'

type PeerInformation = {
  userId: string
  scene?: ILand
}

export type PeerReport = {
  peerAlias: string
  userId: string
  position: ReadOnlyVector3
}

export const peerUpdateObservable = new Observable<Readonly<PeerReport>>()
export const peerRemoveObservable = new Observable<Readonly<PeerReport['peerAlias']>>()

const peersInfo: Record<PeerReport['peerAlias'], PeerInformation> = {}

peerRemoveObservable.add((peerAlias) => {
  const peer = peersInfo[peerAlias]
  if (peer) {
    delete peersInfo[peerAlias]

    if (!peer.scene) {
      return
    }

    const sceneWorker = getSceneWorkerBySceneID(peer.scene.sceneId)
    sceneWorker?.emit('onLeaveScene', { userId: peer.userId })
  }
})

peerUpdateObservable.add(async (event) => {
  const { peerAlias, userId, position } = event

  const peer = peersInfo[peerAlias] ?? { peerAlias, userId, scene: undefined }
  peersInfo[peerAlias] = peer

  if (peer.scene) {
    if (isWorldPositionInsideParcels(peer.scene.sceneJsonData.scene.parcels, position)) {
      return
    }
  }

  const coords = worldToGrid(position)
  const scenesId = await fetchSceneIds([encodeParcelPosition(coords)])

  if (!scenesId[0]) {
    return
  }

  const scenesJson = await fetchSceneJson(scenesId as string[])

  if (peersInfo[peerAlias]) {
    const prevScene = peersInfo[peerAlias].scene
    const newScene = scenesJson[0]

    if (prevScene) {
      const sceneWorker = getSceneWorkerBySceneID(prevScene.sceneId)
      sceneWorker?.emit('onLeaveScene', { userId: peer.userId })
    }

    if (newScene) {
      const sceneWorker = getSceneWorkerBySceneID(newScene.sceneId)
      sceneWorker?.emit('onEnterScene', { userId: peer.userId })
    }

    peersInfo[peerAlias].scene = newScene
  }
})
