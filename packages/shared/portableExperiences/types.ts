import { StorePortableExperience } from 'shared/types'

export type PortableExperiencesState = {
  /** List of denied portable experiences from renderer */
  deniedPortableExperiencesFromRenderer: string[]

  /** List of portable experiences created by scenes */
  portableExperiencesCreatedByScenesList: Record<string, StorePortableExperience>

  /** List of portable experiences loaded at the begining of the execution */
  kernelPortableExperiences: Record<string, StorePortableExperience>

  /** This boolean will enable or disable the execution of portable experience */
  globalPortalExperienceShutDown: boolean
}

export type RootPortableExperiencesState = {
  portableExperiences: PortableExperiencesState
}
