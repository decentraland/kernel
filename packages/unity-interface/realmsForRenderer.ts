import { getExploreRealmsService, getFetchContentServer } from '../shared/dao/selectors'
import { CurrentRealmInfoForRenderer, RealmsInfoForRenderer } from '../shared/types'
import { Realm } from '../shared/dao/types'
import { getUnityInstance } from './IUnityInterface'
import defaultLogger from '../shared/logger'
import { store } from '../shared/store/isolatedStore'
import { getRealm } from 'shared/comms/selectors'
import { observeRealmChange } from 'shared/comms/sagas'

const REPORT_INTERVAL = 2 * 60 * 1000

let isReporting = false

export function startRealmsReportToRenderer() {
  if (!isReporting) {
    isReporting = true

    const realm = getRealm(store.getState())
    if (realm) {
      reportToRenderer({ current: convertCurrentRealmType(realm) })
    }

    observeRealmChange(store, (_previous, current) => {
      reportToRenderer({ current: convertCurrentRealmType(current) })
      fetchAndReportRealmsInfo().catch((e) => defaultLogger.log(e))
    })

    fetchAndReportRealmsInfo().catch((e) => defaultLogger.log(e))

    setInterval(async () => {
      await fetchAndReportRealmsInfo()
    }, REPORT_INTERVAL)
  }
}

async function fetchAndReportRealmsInfo() {
  const url = getExploreRealmsService(store.getState())
  if (url) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const value = await response.json()
        reportToRenderer({ realms: value })
      }
    } catch (e) {
      defaultLogger.error(url, e)
    }
  }
}

function reportToRenderer(info: Partial<RealmsInfoForRenderer>) {
  getUnityInstance().UpdateRealmsInfo(info)
}

function convertCurrentRealmType(realm: Realm): CurrentRealmInfoForRenderer {
  const contentServerUrl = getFetchContentServer(store.getState())
  return {
    serverName: realm.serverName,
    layer: '',
    domain: realm.hostname,
    contentServerUrl: contentServerUrl
  }
}
