import { LoadableScene } from 'shared/types'
import { getServer } from '../manager'

export async function fetchSceneJson(sceneIds: string[]): Promise<LoadableScene[]> {
  const server = getServer()
  if (!server) return []
  const lands = await Promise.all(sceneIds.map((sceneId) => server.getLoadableSceneBySceneId(sceneId)))
  return lands.filter(($) => !!$) as Array<LoadableScene>
}
