import { EntityWithBaseUrl } from '../lib/types'
import { getServer } from '../manager'

export async function fetchSceneJson(sceneIds: string[]): Promise<EntityWithBaseUrl[]> {
  const server = getServer()
  if (!server) return []
  const lands = await Promise.all(sceneIds.map((sceneId) => server.getParcelData(sceneId)))
  return lands
}
