import { eventChannel } from 'redux-saga'
import { getPortableExperienceFromUrn } from 'unity-interface/portableExperiencesUtils'
import { ISceneLoader, SetDesiredScenesCommand } from '../types'

export async function createWorldLoader(options: { urns: string[] }): Promise<ISceneLoader> {
  const scenes = await Promise.all(options.urns.map((urn) => getPortableExperienceFromUrn(urn)))
  return {
    async fetchScenesByLocation(parcels) {
      return { scenes }
    },
    getChannel() {
      return eventChannel<SetDesiredScenesCommand>((emitter) => {
        emitter({ scenes })
        return () => {}
      })
    },
    async reportPosition(positionReport) {
      // noop
    },
    async stop() {}
  }
}
