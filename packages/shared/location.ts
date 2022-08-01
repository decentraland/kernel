let base = new URL('.', globalThis.location.toString()).toString()

export function setResourcesURL(baseUrl: string) {
  base = new URL(baseUrl, globalThis.location.toString()).toString()
}

export function getResourcesURL(path: string) {
  return new URL(path, base).toString()
}
