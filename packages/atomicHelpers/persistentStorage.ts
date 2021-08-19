declare var window: any

let persistentStorage: Storage | null = null

if (window && window.localStorage) {
  setPersistentStorage(window.localStorage)
}

export function setPersistentStorage(storage: Storage) {
  persistentStorage = storage
}

export function saveToPersistentStorage(key: string, data: any) {
  if (!persistentStorage) {
    throw new Error('Storage not supported')
  }
  persistentStorage.setItem(key, JSON.stringify(data))
}

export function getFromPersistentStorage(key: string) {
  if (!persistentStorage) {
    throw new Error('Storage not supported')
  }
  const data = persistentStorage.getItem(key)
  return (data && JSON.parse(data)) || null
}

export function removeFromPersistentStorage(key: string) {
  if (!persistentStorage) {
    throw new Error('Storage not supported')
  }
  persistentStorage.removeItem(key)
}

export function getKeysFromPersistentStorage(): string[] {
  if (!persistentStorage) {
    throw new Error('Storage not supported')
  }

  let keys: string[] = []
  for (let i = 0; i < persistentStorage.length; i++) {
    keys.push(persistentStorage.key(i) as string)
  }

  return keys
}
