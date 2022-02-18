import {
  ContentMapping,
  EnvironmentData,
  LoadablePortableExperienceScene,
  MappingsResponse,
  SceneJsonData,
  StorePortableExperience
} from '../shared/types'
import { getSceneNameFromJsonData } from '../shared/selectors'
import { parseParcelPosition } from '../atomicHelpers/parcelScenePositions'
import { UnityPortableExperienceScene } from './UnityParcelScene'
import { forceStopParcelSceneWorker, getSceneWorkerBySceneID, loadParcelScene } from 'shared/world/parcelSceneManager'
import { getUnityInstance } from './IUnityInterface'
import { resolveUrlFromUrn } from '@dcl/urn-resolver'
import { store } from 'shared/store/isolatedStore'
import { addDebugPortableExperience, removeDebugPortableExperience } from 'shared/portableExperiences/actions'

declare let window: any
// TODO: Remove this when portable experiences are full-available
window['spawnDebugPortableExperienceSceneFromUrn'] = spawnDebugPortableExperienceSceneFromUrn
window['killDebugPortableExperience'] = killDebugPortableExperience

export type PortableExperienceHandle = {
  pid: string
  parentCid: string
}

const currentPortableExperiences: Map<string, UnityPortableExperienceScene> = new Map()

export async function spawnDebugPortableExperienceSceneFromUrn(
  sceneUrn: string,
  parentCid: string
): Promise<PortableExperienceHandle> {
  const data = await getPortableExperienceFromUrn(sceneUrn)

  store.dispatch(addDebugPortableExperience(data))

  return {
    parentCid,
    pid: data.id
  }
}

export function killDebugPortableExperience(urn: string) {
  store.dispatch(removeDebugPortableExperience(urn))
}

function killPortableExperienceScene(sceneUrn: string) {
  const peWorker = getSceneWorkerBySceneID(sceneUrn)
  if (peWorker) {
    forceStopParcelSceneWorker(peWorker)
    currentPortableExperiences.delete(sceneUrn)
    getUnityInstance().UnloadScene(sceneUrn)
  }
}

export function getRunningPortableExperience(sceneId: string): UnityPortableExperienceScene | undefined {
  return currentPortableExperiences.get(sceneId)
}

async function getPortableExperienceFromUrn(sceneUrn: string): Promise<StorePortableExperience> {
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

function getLoadablePortableExperience(data: {
  sceneUrn: string
  baseUrl: string
  mappings: ContentMapping[]
  sceneJsonData: SceneJsonData
}): StorePortableExperience {
  const { sceneUrn, baseUrl, mappings, sceneJsonData } = data

  const sceneJsons = mappings.filter((land) => land.file === 'scene.json')
  if (!sceneJsons.length) {
    throw new Error('Invalid scene mapping: no scene.json')
  }

  return {
    id: sceneUrn,
    name: getSceneNameFromJsonData(sceneJsonData),
    baseUrl: baseUrl,
    mappings: data.mappings,
    menuBarIcon: sceneJsonData.menuBarIcon || '',
    parentCid: 'main'
  }
}

export function getPortableExperiencesLoaded() {
  return new Set(currentPortableExperiences.values())
}

/**
 * Kills all portable experiences that are not present in the given list
 */
export async function declareWantedPortableExperiences(pxs: StorePortableExperience[]) {
  const immutableList = new Set(currentPortableExperiences.keys())

  const wantedIds = pxs.map(($) => $.id)

  // kill extra ones
  for (const id of immutableList) {
    if (!wantedIds.includes(id)) {
      killPortableExperienceScene(id)
    }
  }

  // This timeout is because the killPortableExperience isn't really async
  //  and before spawn the portable experience it's neccesary that be kill
  //  the previous scene
  // TODO: catch the Scene.unloaded and then call the spawn.
  await new Promise((resolve) => setTimeout(resolve, 100))

  // then load all the missing scenes
  for (const sceneData of pxs) {
    if (!getRunningPortableExperience(sceneData.id)) {
      spawnPortableExperience(sceneData)
    }
  }
}

function spawnPortableExperience(spawnData: StorePortableExperience): PortableExperienceHandle {
  const peWorker = getSceneWorkerBySceneID(spawnData.id)

  if (peWorker) {
    throw new Error(`Portable Experience: "${spawnData.id}" is already running.`)
  }

  const mainFile = spawnData.mappings.filter((m) => m.file.endsWith('game.js'))[0]?.hash

  const ZERO_ZERO = parseParcelPosition('0,0')

  const data: EnvironmentData<LoadablePortableExperienceScene> = {
    sceneId: spawnData.id,
    baseUrl: spawnData.baseUrl,
    name: spawnData.name ?? spawnData.id,
    main: mainFile,
    useFPSThrottling: false,
    mappings: spawnData.mappings,
    data: {
      id: spawnData.id,
      basePosition: ZERO_ZERO,
      name: spawnData.name ?? spawnData.id,
      parcels: [ZERO_ZERO],
      baseUrl: spawnData.baseUrl,
      baseUrlBundles: '',
      contents: spawnData.mappings,
      icon: spawnData.menuBarIcon
    }
  }

  return internalSpawnPortableExperience(data, spawnData.parentCid)
}

function internalSpawnPortableExperience(data: EnvironmentData<LoadablePortableExperienceScene>, parentCid: string) {
  const peWorker = getSceneWorkerBySceneID(data.sceneId)

  if (peWorker) {
    throw new Error(`Portable Experience: "${data.sceneId}" is already running.`)
  }

  const scene = new UnityPortableExperienceScene(data, parentCid)
  currentPortableExperiences.set(scene.data.sceneId, scene)
  loadParcelScene(scene, undefined, true)
  getUnityInstance().CreateGlobalScene({
    id: scene.data.sceneId,
    name: scene.data.name,
    baseUrl: scene.data.baseUrl,
    contents: scene.data.data.contents,
    icon: scene.data.data.icon,
    isPortableExperience: true
  })

  return { pid: scene.data.sceneId, parentCid: parentCid }
}
