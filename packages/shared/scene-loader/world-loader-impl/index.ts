import { getPortableExperienceFromUrn } from 'unity-interface/portableExperiencesUtils'
import { ISceneLoader } from '../types'

export function createWorldLoader(options: { urn: string }): ISceneLoader {
  return {
    async fetchScenesByLocation(parcels) {
      const result = await getPortableExperienceFromUrn(options.urn)
      return {
        scenes: [result]
      }
    },
    async *getCommands() {
      const scene = await getPortableExperienceFromUrn(options.urn)
      yield { scenes: [scene] }
    },
    async reportPosition(positionReport) {
      // noop
    },
    async stop() {}
  }
}
