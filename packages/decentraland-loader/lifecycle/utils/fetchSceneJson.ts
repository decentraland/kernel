import { LoadableScene } from 'shared/types'
import { getServer } from '../manager'

export async function fetchSceneJson(entityIds: string[]): Promise<LoadableScene[]> {
  const server = getServer()
  if (!server) return []
  const lands = await Promise.all(entityIds.map((entityId) => server.getLoadableSceneBySceneId(entityId)))
  return lands.filter(($) => !!$) as Array<LoadableScene>
}
