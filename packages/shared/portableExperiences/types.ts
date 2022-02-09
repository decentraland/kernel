export type PortableExperiencesState = {
  /** List of denied portable experiences from renderer */
  deniedPortableExperiencesFromRenderer: string[]
}

export type RootPortableExperiencesState = {
  portableExperiences: PortableExperiencesState
}
