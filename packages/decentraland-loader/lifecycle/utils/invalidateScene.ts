import { getServer } from '../manager'

export async function invalidateScene(sceneId: string) {
  const server = getServer()
  if (!server) return
  return server.invalidateSceneAndCoords(sceneId)
}

export function invalidateScenesByCoords(coordsToInvalidate: string[]) {
  const server = getServer()
  if (!server) return
  return server.invalidateAllScenes(coordsToInvalidate)
}
