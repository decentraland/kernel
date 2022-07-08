import {
  Vector3,
  EcsMathReadOnlyVector3,
  EcsMathReadOnlyQuaternion,
  EcsMathReadOnlyVector2,
  Vector2
} from '@dcl/ecs-math'
import { Observable } from 'mz-observable'
import { InstancedSpawnPoint } from '../types'
import { worldToGrid, gridToWorld, isWorldPositionInsideParcels } from 'atomicHelpers/parcelScenePositions'
import { DEBUG } from '../../config'
import { isInsideWorldLimits, Scene } from '@dcl/schemas'

declare let location: any
declare let history: any

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
export type ParcelReport = {
  /** Parcel where the user was before */
  previousParcel?: EcsMathReadOnlyVector2
  /** Parcel where the user is now */
  newParcel: EcsMathReadOnlyVector2
  /** Should this position be applied immediately */
  immediate: boolean
}

export const positionObservable = new Observable<Readonly<PositionReport>>()
// Called each time the user changes  parcel
export const parcelObservable = new Observable<ParcelReport>()

export const teleportObservable = new Observable<EcsMathReadOnlyVector2 & { text?: string }>()

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
    parcelObservable.notifyObservers({ previousParcel: lastPlayerParcel, newParcel: parcel, immediate })
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

export function initializeUrlPositionObserver() {
  let lastTime: number = performance.now()

  function updateUrlPosition(newParcel: EcsMathReadOnlyVector2) {
    // Update position in URI every second
    if (performance.now() - lastTime > 1000) {
      replaceQueryStringPosition(newParcel.x, newParcel.y)
      lastTime = performance.now()
    }
  }

  parcelObservable.add(({ newParcel }) => {
    updateUrlPosition(newParcel)
  })

  if (lastPlayerPosition.equalsToFloats(0, 0, 0)) {
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
        replaceQueryStringPosition(x, y)
      }
      gridToWorld(x, y, lastPlayerPosition)
    } else {
      lastPlayerPosition.x = Math.round(Math.random() * 10) - 5
      lastPlayerPosition.z = 0
    }
  }

  const v = Vector2.Zero()

  worldToGrid(lastPlayerPosition, v)

  setLastPlayerParcel(v)
}

function replaceQueryStringPosition(x: any, y: any) {
  const currentPosition = `${x | 0},${y | 0}`

  const q = new URLSearchParams(location.search)
  q.set('position', currentPosition)

  history.replaceState({ position: currentPosition }, 'position', `?${q.toString()}`)
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
