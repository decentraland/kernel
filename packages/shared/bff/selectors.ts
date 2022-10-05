import { FETCH_CONTENT_SERVICE, UPDATE_CONTENT_SERVICE } from 'config'
import { select, take } from 'redux-saga/effects'
import { store } from 'shared/store/isolatedStore'
import { SET_BFF } from './actions'
import { urlWithProtocol } from './resolver'
import { IBff, RootBffState } from './types'

export const getBff = (state: RootBffState): IBff | undefined => state.bff.bff

export function* waitForBff() {
  while (true) {
    const bff: IBff | undefined = yield select(getBff)
    if (bff) return bff
    yield take(SET_BFF)
  }
}

export async function ensureBffPromise(): Promise<IBff> {
  const bff = getBff(store.getState())
  if (bff) {
    return bff
  }

  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      const bff = getBff(store.getState())
      if (bff) {
        unsubscribe()
        return resolve(bff)
      }
    })
  })
}



export const getProfilesContentServerFromBff = (bff: IBff) => {
  if (UPDATE_CONTENT_SERVICE) {
    return urlWithProtocol(UPDATE_CONTENT_SERVICE)
  }
  const url = bff.services.legacy.updateContentServer
  return urlWithProtocol(url)
}

/**
 * Returns the fetch content server configured by this BFF.
 *
 * If it is overwritten by url params then that value is returned.
 */
export const getFetchContentServerFromBff = (bff: IBff) => {
  if (FETCH_CONTENT_SERVICE) {
    return urlWithProtocol(FETCH_CONTENT_SERVICE)
  }
  return bff.services.legacy.fetchContentServer
}

/**
 * Returns the base URL to resolve all assets by CID in the configured server
 */
export const getFetchContentUrlPrefixFromBff = (bff: IBff) => {
  return getFetchContentServerFromBff(bff) + '/contents/'
}
