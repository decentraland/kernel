import { call, put, select, takeEvery } from 'redux-saga/effects'

import {
  WITH_FIXED_COLLECTIONS,
  getAssetBundlesBaseUrl,
  getTLD,
  PREVIEW,
  DEBUG,
  ETHEREUM_NETWORK,
  BUILDER_SERVER_URL,
  rootURLPreviewMode,
  WITH_FIXED_ITEMS
} from 'config'

import defaultLogger from 'shared/logger'
import {
  WearablesFailure,
  wearablesFailure,
  WearablesRequest,
  WearablesSuccess,
  wearablesSuccess,
  WEARABLES_FAILURE,
  WEARABLES_REQUEST,
  WEARABLES_SUCCESS
} from './actions'
import {
  WearablesRequestFilters,
  WearableV2,
  BodyShapeRepresentationV2,
  PartialWearableV2,
  UnpublishedWearable
} from './types'
import { waitForRendererInstance } from 'shared/renderer/sagas'
import { CatalystClient, OwnedWearablesWithDefinition } from 'dcl-catalyst-client'
import { fetchJson } from 'dcl-catalyst-commons'
import { getCatalystServer, getFetchContentServer, getSelectedNetwork } from 'shared/dao/selectors'
import { BuilderServerAPIManager } from 'shared/apis/SceneStateStorageController/BuilderServerAPIManager'
import { getCurrentIdentity } from 'shared/session/selectors'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { ExplorerIdentity } from 'shared/session/types'
import { trackEvent } from 'shared/analytics'

export const BASE_AVATARS_COLLECTION_ID = 'urn:decentraland:off-chain:base-avatars'
export const WRONG_FILTERS_ERROR = `You must set one and only one filter for V1. Also, the only collection id allowed is '${BASE_AVATARS_COLLECTION_ID}'`

const BASE_BUILDER_DOWNLOAD_URL = `${BUILDER_SERVER_URL}/storage/contents`

/**
 * This saga handles wearable definition fetching.
 *
 * When the renderer detects a new wearable, but it doesn't know its definition, then it will create a catalog request.
 *
 * This request will include the ids of the unknown wearables. We will then find the appropriate definition, and return it to the renderer.
 *
 */
export function* catalogsSaga(): any {
  yield takeEvery(WEARABLES_REQUEST, handleWearablesRequest)
  yield takeEvery(WEARABLES_SUCCESS, handleWearablesSuccess)
  yield takeEvery(WEARABLES_FAILURE, handleWearablesFailure)
}

export function* handleWearablesRequest(action: WearablesRequest) {
  const { filters, context } = action.payload

  const valid = areFiltersValid(filters)
  if (valid) {
    try {
      const fetchContentServer: string = yield select(getFetchContentServer)

      const response: PartialWearableV2[] = yield call(fetchWearablesFromCatalyst, filters)
      const net: ETHEREUM_NETWORK = yield select(getSelectedNetwork)
      const assetBundlesBaseUrl: string = getAssetBundlesBaseUrl(net) + '/'

      const v2Wearables: WearableV2[] = response.map((wearable) => ({
        ...wearable,
        baseUrl: wearable.baseUrl ?? fetchContentServer + '/contents/',
        baseUrlBundles: assetBundlesBaseUrl
      }))

      yield put(wearablesSuccess(v2Wearables, context))
    } catch (error: any) {
      yield put(wearablesFailure(context, error.message))
    }
  } else {
    yield put(wearablesFailure(context, WRONG_FILTERS_ERROR))
  }
}

function* fetchWearablesFromCatalyst(filters: WearablesRequestFilters) {
  const catalystUrl: string = yield select(getCatalystServer)
  const identity: ExplorerIdentity = yield select(getCurrentIdentity)
  const client: CatalystClient = new CatalystClient({ catalystUrl })
  const network: ETHEREUM_NETWORK = yield select(getSelectedNetwork)
  const COLLECTIONS_OR_ITEMS_ALLOWED =
    PREVIEW || ((DEBUG || getTLD() !== 'org') && network !== ETHEREUM_NETWORK.MAINNET)

  const result: PartialWearableV2[] = []
  if (filters.ownedByUser) {
    if (WITH_FIXED_ITEMS && COLLECTIONS_OR_ITEMS_ALLOWED) {
      const uuidsItems = WITH_FIXED_ITEMS.split(',')
      if (uuidsItems.length > 0 && identity) {
        const v2Wearables: PartialWearableV2[] = yield call(fetchWearableByIdFromBuilder, uuidsItems, identity)
        result.push(...v2Wearables)
      }
    } else if (WITH_FIXED_COLLECTIONS && COLLECTIONS_OR_ITEMS_ALLOWED) {
      // The WITH_FIXED_COLLECTIONS config can only be used in zone. However, we want to be able to use prod collections for testing.
      // That's why we are also querying a prod catalyst for the given collections
      const collectionIds: string[] = WITH_FIXED_COLLECTIONS.split(',')

      // Fetch published collections
      const urnCollections = collectionIds.filter((collectionId) => collectionId.startsWith('urn'))
      if (urnCollections.length > 0) {
        const zoneWearables: PartialWearableV2[] = yield client.fetchWearables({ collectionIds: urnCollections })
        result.push(...zoneWearables)
      }

      // Fetch unpublished collections from builder server
      const uuidCollections = collectionIds.filter((collectionId) => !collectionId.startsWith('urn'))
      if (uuidCollections.length > 0 && identity) {
        const v2Wearables: PartialWearableV2[] = yield call(
          fetchWearablesByCollectionFromBuilder,
          uuidCollections,
          filters,
          identity
        )
        result.push(...v2Wearables)
      }
    } else {
      let ownedWearables: OwnedWearablesWithDefinition[]
      if (filters.thirdPartyId) {
        ownedWearables = yield call(fetchOwnedThirdPartyWearables, filters.ownedByUser, filters.thirdPartyId, client)
      } else {
        ownedWearables = yield call(fetchOwnedWearables, filters.ownedByUser, client)
      }

      for (const { amount, definition } of ownedWearables) {
        if (definition) {
          for (let i = 0; i < amount; i++) {
            result.push(definition)
          }
        }
      }
    }
  } else {
    const wearables: PartialWearableV2[] = yield call(fetchWearablesByFilters, filters, client)
    result.push(...wearables)

    if (WITH_FIXED_ITEMS && COLLECTIONS_OR_ITEMS_ALLOWED) {
      const uuidsItems = WITH_FIXED_ITEMS.split(',')
      if (uuidsItems.length > 0 && identity) {
        const v2Wearables: PartialWearableV2[] = yield call(fetchWearableByIdFromBuilder, uuidsItems, identity)
        result.push(...v2Wearables)
      }
    } else if (WITH_FIXED_COLLECTIONS && COLLECTIONS_OR_ITEMS_ALLOWED) {
      const uuidCollections = WITH_FIXED_COLLECTIONS.split(',').filter(
        (collectionId) => !collectionId.startsWith('urn')
      )
      if (uuidCollections.length > 0 && identity) {
        const v2Wearables: PartialWearableV2[] = yield call(
          fetchWearablesByCollectionFromBuilder,
          uuidCollections,
          filters,
          identity
        )
        result.push(...v2Wearables)
      }
    }
  }

  if (PREVIEW) {
    const v2Wearables: PartialWearableV2[] = yield call(fetchWearablesByCollectionFromPreviewMode, filters)
    result.push(...v2Wearables)
  }

  return result
    .map((wearable) => {
      try {
        return mapCatalystWearableIntoV2(wearable)
      } catch (err) {
        trackEvent('fetchWearablesFromCatalyst_failed', { wearableId: wearable.id })
        defaultLogger.log(`There was an error with wearable ${wearable.id}.`, err)
        return undefined
      }
    })
    .filter((wearable) => !!wearable)
}

function fetchOwnedThirdPartyWearables(ethAddress: string, thirdPartyId: string, client: CatalystClient) {
  return client.fetchOwnedThirdPartyWearables(ethAddress, thirdPartyId, true)
}

function fetchOwnedWearables(ethAddress: string, client: CatalystClient) {
  return client.fetchOwnedWearables(ethAddress, true)
}

async function fetchWearablesByFilters(filters: WearablesRequestFilters, client: CatalystClient) {
  return client.fetchWearables(filters)
}

/**
 * Fetches a single item from the Builder Server.
 */
async function fetchWearableByIdFromBuilder(uuidsItems: string[], identity: ExplorerIdentity): Promise<WearableV2[]> {
  return Promise.all(
    uuidsItems.map(async (uuid) => {
      const path = `items/${uuid}`
      const headers = BuilderServerAPIManager.authorize(identity, 'get', `/${path}`)
      const itemResponse = (await fetchJson(`${BUILDER_SERVER_URL}/${path}`, {
        headers
      })) as { data: UnpublishedWearable; ok: boolean; error?: string }
      if (!itemResponse.ok) {
        throw new Error(itemResponse.error)
      }

      return mapUnpublishedWearableIntoCatalystWearable(itemResponse.data) as WearableV2
    })
  )
}

async function fetchWearablesByCollectionFromBuilder(
  uuidCollections: string[],
  filters: WearablesRequestFilters | undefined,
  identity: ExplorerIdentity
) {
  const result: WearableV2[] = []
  for (const collectionUuid of uuidCollections) {
    if (filters?.collectionIds && !filters.collectionIds.includes(collectionUuid)) {
      continue
    }

    const path = `collections/${collectionUuid}/items`
    const headers = BuilderServerAPIManager.authorize(identity, 'get', `/${path}`)
    const collection: { data: UnpublishedWearable[] } = (await fetchJson(`${BUILDER_SERVER_URL}/${path}`, {
      headers
    })) as any
    const v2Wearables = collection.data.map((wearable) => mapUnpublishedWearableIntoCatalystWearable(wearable))
    result.push(...v2Wearables)
  }
  if (filters?.wearableIds) {
    return result.filter((w) => filters.wearableIds!.includes(w.id))
  }
  return result
}

async function fetchWearablesByCollectionFromPreviewMode(filters: WearablesRequestFilters | undefined) {
  const result: WearableV2[] = []
  try {
    const url = `${rootURLPreviewMode()}/preview-wearables`
    const collection: { data: any[] } = await (await fetch(url)).json()
    result.push(...collection.data)

    if (filters?.wearableIds) {
      return result.filter((w) => filters.wearableIds!.includes(w.id))
    }
  } catch (err) {
    defaultLogger.error(`Couldn't get the preview wearables. Check wearables folder.`, err)
  }
  return result
}

/**
 * We are now mapping wearables that were fetched from the builder server into the same format that is returned by the catalysts
 */
function mapUnpublishedWearableIntoCatalystWearable(wearable: UnpublishedWearable): any {
  const { id, rarity, name, thumbnail, description, data, contents: contentToHash } = wearable
  return {
    id,
    rarity,
    i18n: [{ code: 'en', text: name }],
    thumbnail: `${BASE_BUILDER_DOWNLOAD_URL}/${contentToHash[thumbnail]}`,
    description,
    data: {
      ...data,
      representations: data.representations.map(({ contents, ...other }) => ({
        ...other,
        contents: contents.map((key) => ({
          key,
          url: `${BASE_BUILDER_DOWNLOAD_URL}/${contentToHash[key]}`
        }))
      }))
    }
  }
}

function mapCatalystRepresentationIntoV2(representation: any): BodyShapeRepresentationV2 {
  const { contents, ...other } = representation

  const newContents = contents.map(({ key, url }: { key: string; url: string }) => ({
    key,
    hash: url.substring(url.lastIndexOf('/') + 1)
  }))
  return {
    ...other,
    contents: newContents
  }
}

function mapCatalystWearableIntoV2(v2Wearable: PartialWearableV2): PartialWearableV2 {
  const { id, data, rarity, i18n, thumbnail, description, emoteDataV0 } = v2Wearable
  const { category, tags, hides, replaces, representations } = data
  const newRepresentations: BodyShapeRepresentationV2[] = representations.map(mapCatalystRepresentationIntoV2)
  const index = thumbnail.lastIndexOf('/')
  const newThumbnail = thumbnail.substring(index + 1)
  const baseUrl = thumbnail.substring(0, index + 1)

  return {
    id,
    rarity,
    i18n,
    thumbnail: newThumbnail,
    description,
    data: {
      category,
      tags,
      hides,
      replaces,
      representations: newRepresentations
    },
    baseUrl,
    emoteDataV0
  }
}

export function* handleWearablesSuccess(action: WearablesSuccess) {
  const { wearables, context } = action.payload

  yield call(waitForRendererInstance)
  yield call(sendWearablesCatalog, wearables, context)
}

export function* handleWearablesFailure(action: WearablesFailure) {
  const { context, error } = action.payload

  defaultLogger.error(`Failed to fetch wearables for context '${context}'`, error)

  yield call(waitForRendererInstance)
  yield call(informRequestFailure, error, context)
}

function areFiltersValid(filters: WearablesRequestFilters) {
  let filtersSet = 0
  let ok = true
  if (filters.collectionIds) {
    filtersSet += 1
    if (filters.collectionIds.some((id) => id !== BASE_AVATARS_COLLECTION_ID)) {
      ok = false
    }
  }

  if (filters.ownedByUser) {
    filtersSet += 1
  }

  if (filters.wearableIds) {
    filtersSet += 1
  }

  if (filters.thirdPartyId && !filters.ownedByUser) {
    ok = false
  }

  return filtersSet === 1 && ok
}

export function informRequestFailure(error: string, context: string | undefined) {
  getUnityInstance().WearablesRequestFailed(error, context)
}

export function sendWearablesCatalog(wearables: WearableV2[], context: string | undefined) {
  getUnityInstance().AddWearablesToCatalog(wearables, context)
}
