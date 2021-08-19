import { getCurrentIdentity, hasWallet as hasWalletSelector } from './selectors'
import {
  getFromPersistentStorage,
  getKeysFromPersistentStorage,
  removeFromPersistentStorage,
  saveToPersistentStorage
} from 'atomicHelpers/persistentStorage'
import { StoredSession } from './types'
import { store } from 'shared/store/isolatedStore'

const SESSION_KEY_PREFIX = 'dcl-session'
const LAST_SESSION_KEY = 'dcl-last-session-id'

function sessionKey(userId: string) {
  return `${SESSION_KEY_PREFIX}-${userId.toLocaleLowerCase()}`
}

export const setStoredSession: (session: StoredSession) => void = (session) => {
  saveToPersistentStorage(LAST_SESSION_KEY, session.identity.address)
  saveToPersistentStorage(sessionKey(session.identity.address), session)
}

export const getStoredSession: (userId: string) => StoredSession | null = (userId) => {
  const existingSession: StoredSession | null = getFromPersistentStorage(sessionKey(userId))

  if (existingSession) {
    return existingSession
  } else {
    // If not existing session was found, we check the old session storage
    const oldSession: StoredSession | null = getFromPersistentStorage('dcl-profile') || {}
    if (oldSession && oldSession.identity && oldSession.identity.address === userId) {
      setStoredSession(oldSession)
      return oldSession
    }
  }

  return null
}

export const removeStoredSession = (userId?: string) => {
  if (userId) removeFromPersistentStorage(sessionKey(userId))
}
export const getLastSessionWithoutWallet: () => StoredSession | null = () => {
  const lastSessionId = getFromPersistentStorage(LAST_SESSION_KEY)
  if (lastSessionId) {
    const lastSession = getStoredSession(lastSessionId)
    return lastSession ? lastSession : null
  } else {
    return getFromPersistentStorage('dcl-profile')
  }
}

export const getLastSessionByAddress = (address: string): StoredSession | null => {
  const sessions: StoredSession[] = getKeysFromPersistentStorage()
    .filter((k) => k.indexOf(SESSION_KEY_PREFIX) === 0)
    .map((id) => getFromPersistentStorage(id) as StoredSession)
    .filter(({ identity }) => ('' + identity.address).toLowerCase() === address.toLowerCase())

  return sessions.length > 0 ? sessions[0] : null
}

export const getLastGuestSession = (): StoredSession | null => {
  const sessions: StoredSession[] = getKeysFromPersistentStorage()
    .filter((k) => k.indexOf(SESSION_KEY_PREFIX) === 0)
    .map((id) => getFromPersistentStorage(id) as StoredSession)
    .filter(({ isGuest }) => isGuest)
    .sort((a, b) => {
      const da = new Date(a.identity.expiration)
      const db = new Date(b.identity.expiration)
      if (da > db) return -1
      if (da < db) return 1
      return 0
    }) // last expiration is first

  return sessions.length > 0 ? sessions[0] : null
}

export const getIdentity = () => getCurrentIdentity(store.getState())

export const hasWallet = () => hasWalletSelector(store.getState())
