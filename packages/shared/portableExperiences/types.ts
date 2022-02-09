
export type PortableExperiencesState = {
  runningPortableExperiences: Record<string, {}>

  /** List of denied portable experiences from renderer */
  deniedPortableExperiencesFromRenderer: string[]
}

export type RootPortableExperiencesState = {
  portableExperiences: PortableExperiencesState
}