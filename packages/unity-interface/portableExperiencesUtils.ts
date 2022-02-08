import {
  ContentMapping,
  EnvironmentData,
  LoadablePortableExperienceScene,
  MappingsResponse,
  SceneJsonData
} from '../shared/types'
import { getSceneNameFromJsonData } from '../shared/selectors'
import { parseParcelPosition } from '../atomicHelpers/parcelScenePositions'
import { UnityPortableExperienceScene } from './UnityParcelScene'
import { forceStopParcelSceneWorker, getSceneWorkerBySceneID, loadParcelScene } from 'shared/world/parcelSceneManager'
import { getUnityInstance } from './IUnityInterface'
import { resolveUrlFromUrn } from '@dcl/urn-resolver'
import { getCurrentUserProfile } from 'shared/profiles/selectors'
import { store } from 'shared/store/isolatedStore'

declare let window: any
// TODO: Remove this when portable experiences are full-available
window['spawnPortableExperienceScene'] = spawnPortableExperienceScene
window['killPortableExperienceScene'] = killPortableExperienceScene

export type PortableExperienceHandle = {
  pid: string
  parentCid: string
}

const currentPortableExperiences: Map<string, string> = new Map()
let disabledPEXList: string[] = []

export async function spawnPortableExperienceScene(
  sceneUrn: string,
  parentCid: string
): Promise<PortableExperienceHandle> {
  if (disabledPEXList.includes(sceneUrn)) {
    return { pid: '', parentCid: '' }
  }

  const peWorker = getSceneWorkerBySceneID(sceneUrn)
  if (peWorker) {
    throw new Error(`Portable Scene: "${sceneUrn}" is already running.`)
  }
  const scene = new UnityPortableExperienceScene(await getPortableExperienceFromS3Bucket(sceneUrn))
  loadParcelScene(scene, undefined, true)
  getUnityInstance().CreateGlobalScene({
    id: sceneUrn,
    name: scene.data.name,
    baseUrl: scene.data.baseUrl,
    contents: scene.data.data.contents,
    icon: scene.data.data.icon,
    isPortableExperience: true
  })
  currentPortableExperiences.set(sceneUrn, parentCid)

  return { pid: sceneUrn, parentCid: parentCid }
}

export async function killPortableExperienceScene(sceneUrn: string): Promise<boolean> {
  const peWorker = getSceneWorkerBySceneID(sceneUrn)
  if (peWorker) {
    forceStopParcelSceneWorker(peWorker)
    currentPortableExperiences.delete(sceneUrn)
    getUnityInstance().UnloadScene(sceneUrn)
    return true
  } else {
    return false
  }
}

export async function getPortableExperience(pid: string): Promise<PortableExperienceHandle | undefined> {
  const parentCid = currentPortableExperiences.get(pid)
  return parentCid ? { pid, parentCid } : undefined
}

export async function getPortableExperienceFromS3Bucket(sceneUrn: string) {
  const mappingsUrl = await resolveUrlFromUrn(sceneUrn)
  if (mappingsUrl === null) {
    throw new Error(`Could not resolve mappings for scene: ${sceneUrn}`)
  }
  const mappingsFetch = await fetch(mappingsUrl)
  const mappingsResponse = (await mappingsFetch.json()) as MappingsResponse

  const sceneJsonMapping = mappingsResponse.contents.find(($) => $.file === 'scene.json')

  if (sceneJsonMapping) {
    const baseUrl: string = new URL('.', mappingsUrl).toString()
    const sceneUrl = `${baseUrl}${sceneJsonMapping.hash}`
    const sceneResponse = await fetch(sceneUrl)

    if (sceneResponse.ok) {
      const scene = (await sceneResponse.json()) as SceneJsonData
      return getLoadablePortableExperience({
        sceneUrn: sceneUrn,
        baseUrl: baseUrl,
        mappings: mappingsResponse.contents,
        sceneJsonData: scene
      })
    } else {
      throw new Error('Could not load scene.json')
    }
  } else {
    throw new Error('Could not load scene.json')
  }
}

export async function getLoadablePortableExperience(data: {
  sceneUrn: string
  baseUrl: string
  mappings: ContentMapping[]
  sceneJsonData: SceneJsonData
}): Promise<EnvironmentData<LoadablePortableExperienceScene>> {
  const { sceneUrn, baseUrl, mappings, sceneJsonData } = data

  const sceneJsons = mappings.filter((land) => land.file === 'scene.json')
  if (!sceneJsons.length) {
    throw new Error('Invalid scene mapping: no scene.json')
  }
  // TODO: obtain sceneId from Content Server
  return {
    sceneId: sceneUrn,
    baseUrl: baseUrl,
    name: getSceneNameFromJsonData(sceneJsonData),
    main: sceneJsonData.main,
    useFPSThrottling: false,
    mappings,
    data: {
      id: sceneUrn,
      basePosition: parseParcelPosition(sceneJsonData.scene.base),
      name: getSceneNameFromJsonData(sceneJsonData),
      parcels:
        (sceneJsonData &&
          sceneJsonData.scene &&
          sceneJsonData.scene.parcels &&
          sceneJsonData.scene.parcels.map(parseParcelPosition)) ||
        [],
      baseUrl: baseUrl,
      baseUrlBundles: '',
      contents: mappings,
      icon: sceneJsonData.menuBarIcon
    }
  }
}

export async function getPortableExperiencesLoaded() {
  const portableExperiences: any[] = []
  for (const [id, parentCid] of currentPortableExperiences) {
    portableExperiences.push({ id, parentCid })
  }
  return { portableExperiences: portableExperiences }
}

export async function spawnPortableExperience(
  id: string,
  parentCid: string,
  name: string,
  baseUrl: string,
  mappings: ContentMapping[],
  icon?: string
): Promise<PortableExperienceHandle> {
  if (disabledPEXList.includes(id)) {
    return { pid: '', parentCid: '' }
  }

  const peWorker = getSceneWorkerBySceneID(id)
  if (peWorker) {
    throw new Error(`Portable Scene: "${id}" is already running.`)
  }

  const sceneJsonData: SceneJsonData = {
    main: mappings.filter((m) => m.file.endsWith('game.js'))[0]?.hash,
    display: { title: name },
    menuBarIcon: icon,
    scene: {
      base: '0,0',
      parcels: ['0,0']
    }
  }

  const data: EnvironmentData<LoadablePortableExperienceScene> = {
    sceneId: id,
    baseUrl: baseUrl,
    name: sceneJsonData.display?.title ?? id,
    main: sceneJsonData.main,
    useFPSThrottling: false,
    mappings,
    data: {
      id: id,
      basePosition: parseParcelPosition(sceneJsonData.scene.base),
      name: sceneJsonData.display?.title ?? id,
      parcels:
        (sceneJsonData &&
          sceneJsonData.scene &&
          sceneJsonData.scene.parcels &&
          sceneJsonData.scene.parcels.map(parseParcelPosition)) ||
        [],
      baseUrl: baseUrl,
      baseUrlBundles: '',
      contents: mappings,
      icon: sceneJsonData.menuBarIcon
    }
  }

  const scene = new UnityPortableExperienceScene(data)
  loadParcelScene(scene, undefined, true)

  getUnityInstance().CreateGlobalScene({
    id: id,
    name: scene.data.name,
    baseUrl: scene.data.baseUrl,
    contents: scene.data.data.contents,
    icon: scene.data.data.icon,
    isPortableExperience: true
  })
  currentPortableExperiences.set(id, parentCid)

  return { pid: id, parentCid: parentCid }
}

export async function setDisabledPortableExperiences(idsToDisable: string[]) {
  idsToDisable.forEach(async (pexId) => {
    if (currentPortableExperiences.has(pexId)) {
      await killPortableExperienceScene(pexId)
    }
  })

  const profile = getCurrentUserProfile(store.getState())
  profile?.avatar.wearables.forEach((wearableId) => {
    if (!idsToDisable.includes(wearableId)) {
      // TODO: SPAWN PORTABLE EXPERIENCE WITH ID = wearableId (if it is an equipped smart wearable)
    }
  })

  disabledPEXList = idsToDisable
}
