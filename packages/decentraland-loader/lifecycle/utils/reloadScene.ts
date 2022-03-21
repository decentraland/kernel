import { getServer } from '../manager'

export async function reloadScene(sceneId: string) {
  const server = getServer()
  if (!server) return
  return server.reloadScene(sceneId)
}

export function invalidateAllScenes(coordsToInvalidate: string[]) {
  const server = getServer()
  if (!server) return
  return server.invalidateAllScenes(coordsToInvalidate)
}
