import { LoadableScene } from 'shared/types'
import { getServer } from '../manager'

export async function fetchSceneJson(sceneIds: string[]): Promise<LoadableScene[]> {
  const server = getServer()
  if (!server) return []
  const lands = await Promise.all(sceneIds.map((sceneId) => server.getParcelData(sceneId)))
  return lands.filter($ => !!$)
}
