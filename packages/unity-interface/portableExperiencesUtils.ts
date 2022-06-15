import {
  ContentMapping,
  EnvironmentData,
  LoadablePortableExperienceScene,
  SceneJsonData,
  StorePortableExperience
} from '../shared/types'
import { getSceneNameFromJsonData } from '../shared/selectors'
import { parseParcelPosition } from '../atomicHelpers/parcelScenePositions'
import { UnityPortableExperienceScene } from './UnityParcelScene'
import { forceStopSceneWorker, getSceneWorkerBySceneID, loadParcelScene } from 'shared/world/parcelSceneManager'
import { getUnityInstance } from './IUnityInterface'
import { parseUrn, resolveContentUrl } from '@dcl/urn-resolver'
import { Entity } from 'dcl-catalyst-commons'
import { store } from 'shared/store/isolatedStore'
import { addScenePortableExperience, removeScenePortableExperience } from 'shared/portableExperiences/actions'
import { sleep } from 'atomicHelpers/sleep'

declare let window: any

// TODO: Remove this when portable experiences are full-available
window['spawnScenePortableExperienceSceneFromUrn'] = spawnScenePortableExperienceSceneFromUrn
window['killScenePortableExperience'] = killScenePortableExperience

export type PortableExperienceHandle = {
  pid: string
  parentCid: string
}

const currentPortableExperiences: Map<string, UnityPortableExperienceScene> = new Map()

export async function spawnScenePortableExperienceSceneFromUrn(
  sceneUrn: string,
  parentCid: string
): Promise<PortableExperienceHandle> {
  const data = await getPortableExperienceFromUrn(sceneUrn)

  store.dispatch(addScenePortableExperience(data))

  return {
    parentCid,
    pid: data.id
  }
}

export function killScenePortableExperience(urn: string) {
  store.dispatch(removeScenePortableExperience(urn))
}

export function getRunningPortableExperience(sceneId: string): UnityPortableExperienceScene | undefined {
  return currentPortableExperiences.get(sceneId)
}

export async function getPortableExperienceFromUrn(
  sceneUrn: string
): Promise<StorePortableExperience & { entity: Entity }> {
  const resolvedEntity = await parseUrn(sceneUrn)

  if (resolvedEntity === null || resolvedEntity.type !== 'entity') {
    throw new Error(`Could not resolve mappings for scene: ${sceneUrn}`)
  }

  const resolvedUrl = await resolveContentUrl(resolvedEntity)

  if (!resolvedUrl) {
    throw new Error('Could not resolve URL to download ' + sceneUrn)
  }

  const result = await fetch(resolvedUrl)
  const entity = (await result.json()) as Entity
  const baseUrl: string = resolvedEntity.baseUrl || new URL('.', resolvedUrl).toString()
  const mappings = entity.content || []

  return Object.assign(
    await getLoadablePortableExperience({
      sceneUrn: resolvedEntity.uri.href.replace(/(\?.+)$/, ''),
      baseUrl: baseUrl,
      mappings: mappings
    }),
    { entity }
  )
}

async function getLoadablePortableExperience(data: {
  sceneUrn: string
  baseUrl: string
  mappings: ContentMapping[]
}): Promise<StorePortableExperience> {
  const { sceneUrn, baseUrl, mappings } = data

  const sceneJsonMapping = mappings.find(($) => $.file === 'scene.json')

  if (!sceneJsonMapping) {
    throw new Error('Invalid scene mapping: no scene.json')
  }

  const sceneUrl = `${baseUrl}${sceneJsonMapping.hash}`
  const sceneResponse = await fetch(sceneUrl)

  if (sceneResponse.ok) {
    const sceneJsonData = (await sceneResponse.json()) as SceneJsonData

    return {
      id: sceneUrn,
      name: getSceneNameFromJsonData(sceneJsonData),
      baseUrl: baseUrl,
      mappings: data.mappings,
      menuBarIcon: sceneJsonData.menuBarIcon || '',
      parentCid: 'main'
    }
  } else {
    throw new Error('Error fetching scene.json: ' + sceneUrl)
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
  for (const sceneUrn of immutableList) {
    if (!wantedIds.includes(sceneUrn)) {
      const scene = getRunningPortableExperience(sceneUrn)
      if (scene) {
        currentPortableExperiences.delete(sceneUrn)
        forceStopSceneWorker(scene.worker)
      }
    }
  }

  // TODO: this is an ugh workaround, fix controlling the scene lifecycle
  // knowing when the scene was completly removed and then re-spawn it
  await sleep(250)

  // then load all the missing scenes
  for (const sceneData of pxs) {
    if (!getRunningPortableExperience(sceneData.id)) {
      spawnPortableExperience(sceneData)
    }
  }
}

function spawnPortableExperience(spawnData: StorePortableExperience): PortableExperienceHandle {
  if (currentPortableExperiences.has(spawnData.id) || getSceneWorkerBySceneID(spawnData.id)) {
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

  const scene = new UnityPortableExperienceScene(data, spawnData.parentCid)
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

  return { pid: scene.data.sceneId, parentCid: spawnData.parentCid }
}
