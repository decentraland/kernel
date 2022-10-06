import { RootSceneLoaderState } from "./types";

export const getSceneLoader = (state: RootSceneLoaderState) => state.sceneLoader.loader
export const getParcelPosition = (state: RootSceneLoaderState) => state.sceneLoader.parcelPosition