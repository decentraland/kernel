import { LoadableScene } from 'shared/types'
import { getServer } from '../manager'

export async function fetchScenesByLocation(parcels: string[]): Promise<Array<LoadableScene>> {
  const server = getServer()
  if (!server) return []
  const results = await Promise.all(server.getLoadableScenesByPosition(parcels))
  return results.filter(($) => !!$) as Array<LoadableScene>
}
