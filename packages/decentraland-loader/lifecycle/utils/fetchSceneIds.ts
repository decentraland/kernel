import { LoadableScene } from 'shared/types'
import { getServer } from '../manager'

export async function fetchSceneByLocation(parcels: string[]): Promise<Array<LoadableScene>> {
  const server = getServer()
  if (!server) return []
  const promises = server.getSceneIds(parcels)
  const results = await Promise.all(promises)
  return results.filter($ => !!$) as Array<LoadableScene>
}
