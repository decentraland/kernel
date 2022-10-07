import { Vector3, EcsMathReadOnlyVector3, EcsMathReadOnlyQuaternion, Vector2 } from '@dcl/ecs-math'
import { Observable } from 'mz-observable'
import { InstancedSpawnPoint } from '../types'
import { worldToGrid, gridToWorld, isWorldPositionInsideParcels } from 'atomicHelpers/parcelScenePositions'
import { DEBUG } from '../../config'
import { isInsideWorldLimits, Scene } from '@dcl/schemas'
import { store } from 'shared/store/isolatedStore'
import { setParcelPosition } from 'shared/scene-loader/actions'

export type PositionReport = {
  /** Camera position, world space */
  position: EcsMathReadOnlyVector3
  /** Avatar rotation */
  quaternion: EcsMathReadOnlyQuaternion
  /** Avatar rotation, euler from quaternion */
  rotation: EcsMathReadOnlyVector3
  /** Camera height, relative to the feet of the avatar or ground */
  playerHeight: number
  /** Should this position be applied immediately */
  immediate: boolean
  /** Camera rotation */
  cameraQuaternion: EcsMathReadOnlyQuaternion
  /** Camera rotation, euler from quaternion */
  cameraEuler: EcsMathReadOnlyVector3
}

export const positionObservable = new Observable<Readonly<PositionReport>>()

export const lastPlayerPosition = new Vector3()
export let lastPlayerPositionReport: Readonly<PositionReport> | null = null

positionObservable.add((event) => {
  lastPlayerPosition.copyFrom(event.position)
  lastPlayerPositionReport = event
})

// Listen to position changes, and notify if the parcel changed
let lastPlayerParcel: Vector2
positionObservable.add(({ position, immediate }) => {
  const parcel = Vector2.Zero()
  worldToGrid(position, parcel)
  if (!lastPlayerParcel || parcel.x !== lastPlayerParcel.x || parcel.y !== lastPlayerParcel.y) {
    store.dispatch(setParcelPosition(parcel))
    setLastPlayerParcel(parcel)
  }
})

function setLastPlayerParcel(parcel: Vector2) {
  if (!lastPlayerParcel) {
    lastPlayerParcel = parcel
  } else {
    lastPlayerParcel.copyFrom(parcel)
  }
}

// sets the initial state of the position based on the URL query params
export function getInitialPositionFromUrl(): ReadOnlyVector2 | undefined {
  // LOAD INITIAL POSITION IF SET TO ZERO
  const query = new URLSearchParams(location.search)
  const position = query.get('position')
  if (typeof position === 'string') {
    const [xString, yString] = position.split(',')
    let x = parseFloat(xString)
    let y = parseFloat(yString)

    if (!isInsideWorldLimits(x, y)) {
      x = 0
      y = 0
    }

    return { x, y }
  }
}

/**
 * Computes the spawn point based on a scene.
 *
 * The computation takes the spawning points defined in the scene document and computes the spawning point in the world based on the base parcel position.
 *
 * @param land Scene on which the player is spawning
 */
export function pickWorldSpawnpoint(land: Scene): InstancedSpawnPoint {
  const pick = pickSpawnpoint(land)

  const spawnpoint = pick || { position: { x: 0, y: 0, z: 0 } }

  const baseParcel = land.scene.base
  const [bx, by] = baseParcel.split(',')

  const basePosition = new Vector3()

  const { position, cameraTarget } = spawnpoint

  gridToWorld(parseInt(bx, 10), parseInt(by, 10), basePosition)

  return {
    position: basePosition.add(position),
    cameraTarget: cameraTarget ? basePosition.add(cameraTarget) : undefined
  }
}

function pickSpawnpoint(land: Scene): InstancedSpawnPoint | undefined {
  if (!land || !land.spawnPoints || land.spawnPoints.length === 0) {
    return undefined
  }

  // 1 - default spawn points
  const defaults = land.spawnPoints.filter(($) => $.default)

  // 2 - if no default spawn points => all existing spawn points
  const eligiblePoints = defaults.length === 0 ? land.spawnPoints : defaults

  // 3 - pick randomly between spawn points
  const { position, cameraTarget } = eligiblePoints[Math.floor(Math.random() * eligiblePoints.length)]

  // 4 - generate random x, y, z components when in arrays
  const finalPosition = {
    x: computeComponentValue(position.x),
    y: computeComponentValue(position.y),
    z: computeComponentValue(position.z)
  }

  // 5 - If the final position is outside the scene limits, we zero it
  if (!DEBUG) {
    const sceneBaseParcelCoords = land.scene.base.split(',')
    const sceneBaseParcelWorldPos = gridToWorld(
      parseInt(sceneBaseParcelCoords[0], 10),
      parseInt(sceneBaseParcelCoords[1], 10)
    )
    const finalWorldPosition = {
      x: sceneBaseParcelWorldPos.x + finalPosition.x,
      y: finalPosition.y,
      z: sceneBaseParcelWorldPos.z + finalPosition.z
    }

    if (!isWorldPositionInsideParcels(land.scene.parcels, finalWorldPosition)) {
      finalPosition.x = 0
      finalPosition.z = 0
    }
  }

  return {
    position: finalPosition,
    cameraTarget
  }
}

function computeComponentValue(x: number | number[]) {
  if (typeof x === 'number') {
    return x
  }

  const length = x.length
  if (length === 0) {
    return 0
  } else if (length < 2) {
    return x[0]
  } else if (length > 2) {
    x = [x[0], x[1]]
  }

  let [min, max] = x

  if (min === max) return max

  if (min > max) {
    const aux = min
    min = max
    max = aux
  }

  return Math.random() * (max - min) + min
}
