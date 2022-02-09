import { RootPortableExperiencesState } from "./types"

export const isRunningPortableExperience = (store: RootPortableExperiencesState, id: string): boolean =>
  id in store.portableExperiences.runningPortableExperiences

export const getPortableExperienceDenyList = (store: RootPortableExperiencesState) => store.portableExperiences.deniedPortableExperiencesFromRenderer