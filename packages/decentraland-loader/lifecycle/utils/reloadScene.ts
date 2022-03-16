import { getServer } from '../manager'

export async function reloadScene(sceneId: string) {
  const server = getServer()
  if (!server) return
  return server.reloadScene(sceneId)
}

export async function reloadSceneByCoords(coords: string) {
  const server = getServer()
  if (!server) return
  return server.reloadSceneByCoords(coords)
}

export function invalidateAllScenes() {
  const server = getServer()
  if (!server) return
  return server.invalidateAllScenes()
}
