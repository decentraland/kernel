import { Wearable } from "@dcl/schemas"

export type Catalog = WearableWithBaseUrl[]

export type UnpublishedWearable = {
  id: string // uuid
  rarity: string
  name: string
  thumbnail: string
  description: string
  data: {
    category: string
    tags: string[]
    hides?: string[]
    replaces?: string[]
    representations: UnpublishedBodyShapeRepresentation[]
  }
  contents: Record<string, string> // from file name to hash
}

type UnpublishedBodyShapeRepresentation = {
  bodyShapes: string[]
  mainFile: string
  overrideHides?: string[]
  overrideReplaces?: string[]
  contents: string[]
}

export type WearableWithBaseUrl = Wearable & {
  baseUrl: string
  baseUrlBundles: string
}

export type WearableId = string

export type ColorString = string

export type CatalogState = {
  catalogs: {
    [key: string]: { id: string; status: "error" | "ok"; data?: Record<WearableId, WearableWithBaseUrl>; error?: any }
  }
}

export type RootCatalogState = {
  catalogs: CatalogState
}

export type WearablesRequestFilters = {
  ownedByUser?: string
  wearableIds?: WearableId[]
  collectionIds?: string[]
}
