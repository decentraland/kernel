import { action } from 'typesafe-actions'

import type { UnityGame } from '@dcl/unity-renderer/src/index'

import { RENDERER_INITIALIZED_CORRECTLY, PARCEL_LOADING_STARTED, RENDERER_INITIALIZE } from './types'

export const initializeRenderer = (delegate: (container: HTMLElement) => Promise<UnityGame>, container: HTMLElement) =>
  action(RENDERER_INITIALIZE, { delegate, container })
export type InitializeRenderer = ReturnType<typeof initializeRenderer>

export const signalRendererInitializedCorrectly = () => action(RENDERER_INITIALIZED_CORRECTLY)
export type SignalRendererInitialized = ReturnType<typeof signalRendererInitializedCorrectly>

export const signalParcelLoadingStarted = () => action(PARCEL_LOADING_STARTED)
export type SignalParcelLoadingStarted = ReturnType<typeof signalParcelLoadingStarted>
