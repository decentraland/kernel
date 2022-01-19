import { RootCatalogState, WearableWithBaseUrl, WearableId } from './types'

export const getPlatformCatalog = (store: RootCatalogState): Record<WearableId, WearableWithBaseUrl> | null =>
  store.catalogs &&
  store.catalogs.catalogs &&
  store.catalogs.catalogs['base-avatars'] &&
  store.catalogs.catalogs['base-avatars'].status === 'ok'
    ? store.catalogs.catalogs['base-avatars'].data!
    : null

export const baseCatalogsLoaded = (store: RootCatalogState) =>
  store.catalogs &&
  store.catalogs.catalogs &&
  store.catalogs.catalogs['base-avatars'] &&
  store.catalogs.catalogs['base-avatars'].status === 'ok'
