import { RootPortableExperiencesState } from './types'

export const getPortableExperienceDenyList = (store: RootPortableExperiencesState) =>
  store.portableExperiences.deniedPortableExperiencesFromRenderer
