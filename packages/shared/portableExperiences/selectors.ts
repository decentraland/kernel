import { StorePortableExperience } from 'shared/types'
import { RootPortableExperiencesState } from './types'

export const getPortableExperienceDenyList = (store: RootPortableExperiencesState) =>
  store.portableExperiences.deniedPortableExperiencesFromRenderer

export const getDebugPortableExperiences = (store: RootPortableExperiencesState): StorePortableExperience[] =>
  Object.values(store.portableExperiences.debugPortableExperiencesList)

export const getPortableExperiencesCreatedByScenes = (store: RootPortableExperiencesState): StorePortableExperience[] =>
  Object.values(store.portableExperiences.portableExperiencesCreatedByScenesList)
