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

export function resolveCommsV3Urls(realm: Realm): { pingUrl: string; wsUrl: string } | undefined {
  if (realm.protocol !== 'v3') return

  function httpToWs(url: string) {
    return url.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
  }

  let server = 'https://explorer-bff.decentraland.io'

  if (realm.hostname === 'local') {
    server = 'http://127.0.0.1:5000'
  } else if (realm.hostname === 'remote') {
    server = 'https://explorer-bff.decentraland.io'
  } else {
    server = realm.hostname.match(/:\/\//) ? realm.hostname : 'https://' + realm.hostname
  }

  const pingUrl = new URL('./status', server).toString()
  const wsUrl = httpToWs(new URL('./ws-bff', server).toString())

  return { pingUrl, wsUrl }
}
