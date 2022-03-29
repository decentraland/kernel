import { action } from 'typesafe-actions'

export const SET_CAMERA_MODE = 'SET_CAMERA_MODE'
export const setCameraMode = (cameraMode: IEvents['cameraModeChanged']['cameraMode'], sceneId?: string) =>
  action(SET_CAMERA_MODE, { cameraMode, sceneId })
export type SetCameraMode = ReturnType<typeof setCameraMode>
