import { action } from 'typesafe-actions'
import { ISceneLoader } from './types'

export const SET_SCENE_LOADER = 'SET_SCENE_LOADER'
export const setSceneLoader = (loader: ISceneLoader | undefined) => action(SET_SCENE_LOADER, { loader })
export type SetSceneLoader = ReturnType<typeof setSceneLoader>

export const SET_WORLD_LOADING_RADIUS = 'SET WORLD LOADING RADIUS'
export const setWorldLoadingRadius = (radius: number) => action(SET_WORLD_LOADING_RADIUS, { radius })
export type SetWorldLoadingRadius = ReturnType<typeof setWorldLoadingRadius>

/**
 * Used to set the parcel position and to react to changes in the x,y
 */
export const SET_PARCEL_POSITION = 'SET_PARCEL_POSITION'
export const setParcelPosition = (position: ReadOnlyVector2) => action(SET_PARCEL_POSITION, { position })
export type SetParcelPosition = ReturnType<typeof setParcelPosition>

export const TELEPORT_TO = 'TELEPORT_TO'
export const teleportToAction = (position: ReadOnlyVector3) => action(TELEPORT_TO, { position })
export type TeleportToAction = ReturnType<typeof teleportToAction>

/**
 * Enables the renderer when the scene in which we are teleporting finishes
 * loading. The .position indicates the spawn point of the scene.
 */
export const POSITION_SETTLED = 'POSITION_SETTLED'
export const positionSettled = (position: ReadOnlyVector3, cameraTarget?: ReadOnlyVector3) =>
  action(POSITION_SETTLED, { position, cameraTarget })
export type PositionSettled = ReturnType<typeof positionSettled>

/**
 * Disables the renderer when we teleport to a specific place and the
 * scenes are not yet loaded.
 */
export const POSITION_UNSETTLED = 'POSITION_UNSETTLED'
export const positionUnsettled = () => action(POSITION_UNSETTLED, {})
export type PositionUnsettled = ReturnType<typeof positionUnsettled>
