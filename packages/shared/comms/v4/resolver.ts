import { Realm } from 'shared/dao/types'

function normalizeUrl(url: string) {
  return url.replace(/^:\/\//, window.location.protocol + '//')
}

// adds the currently used protocol to the given URL
export function urlWithProtocol(url: string) {
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('://'))
    return normalizeUrl(`://${url}`)

  return normalizeUrl(url)
}

export function resolveCommsV4Urls(realm: Realm): { pingUrl: string; wsUrl: string } | undefined {
  if (realm.protocol !== 'v4') return

  function httpToWs(url: string) {
    return url.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
  }

  let server: string
  if (realm.hostname === 'local') {
    server = 'http://127.0.0.1:5002'
  } else if (realm.hostname === 'remote') {
    server = 'https://explorer-bff.decentraland.io'
  } else {
    server = realm.hostname.match(/:\/\//) ? realm.hostname : 'https://' + realm.hostname + '/bff'
  }

  const wsUrl = httpToWs(`${server}/ws-bff`)
  const pingUrl = `${server}/status`
  return { pingUrl, wsUrl }
}
