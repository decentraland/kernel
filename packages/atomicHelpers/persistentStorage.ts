import type { PersistentAsyncStorage } from "@dcl/kernel-interface"

declare var window: any

class PersistentLocalStorage implements PersistentAsyncStorage {
  storage: any
  constructor(storage: any){
    if (storage) {
      this.storage = storage
    }else{
      throw new Error("Cannot create PersistentLocalStorage without localStorage object")
    }
  }

  clear(): Promise<void> {
    console.log("PersistentLocalStorage::clear")
    return new Promise(resolve => {
      this.storage.clear()
      resolve()
    })
  }

  getItem(key: string): Promise<string | null> {
    console.log("PersistentLocalStorage::getItem", key)
    return new Promise(resolve => {
      resolve(this.storage.getItem(key))
    })
  }

  keys(): Promise<string[]> {
    console.log("PersistentLocalStorage::keys")
    return new Promise(resolve => {
      let keys: string[] = []
      for (let i = 0; i < this.storage.length; i++) {
        keys.push(this.storage.key(i) as string)
      }
      resolve(keys)
    })
  }

  removeItem(key: string): Promise<void> {
    console.log("PersistentLocalStorage::removeItem", key)
    return new Promise(resolve => {
      this.storage.removeItem(key)
      resolve()
    })
  }

  setItem(key: string, value: string): Promise<void> {
    console.log("PersistentLocalStorage::setItem", key, value)
    return new Promise(resolve => {
      this.storage.setItem(key, value)
      resolve()
    })
  }

}

let persistentStorage: PersistentAsyncStorage | null = null
if (window && window.localStorage) {
  persistentStorage = new PersistentLocalStorage(window.localStorage)
}

export function setPersistentStorage(storage: PersistentAsyncStorage) {
  persistentStorage = storage
}

export default persistentStorage

export async function saveToPersistentStorage(key: string, data: any) {
  if (!persistentStorage) {
    throw new Error('Storage not supported')
  }
  return persistentStorage.setItem(key, JSON.stringify(data))
}

export async function getFromPersistentStorage(key: string) {
  if (!persistentStorage) {
    throw new Error('Storage not supported')
  }
  const data = await persistentStorage.getItem(key)
  return (data && JSON.parse(data)) || null
}

export async function removeFromPersistentStorage(key: string) {
  if (!persistentStorage) {
    throw new Error('Storage not supported')
  }
  return persistentStorage.removeItem(key)
}

export async function getKeysFromPersistentStorage(): Promise<string[]> {
  if (!persistentStorage) {
    throw new Error('Storage not supported')
  }
  return await persistentStorage.keys()
}