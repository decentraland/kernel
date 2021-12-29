import { CLASS_ID } from '@dcl/legacy-ecs'
import { store } from 'shared/store/isolatedStore'
import { getFetchContentServer, getSelectedNetwork } from 'shared/dao/selectors'
import { SceneSourcePlacement } from 'shared/types'
import { ContentClient } from 'dcl-catalyst-client'
import { EntityType } from 'dcl-catalyst-commons'
import { Asset, AssetId, BuilderAsset, CONTENT_PATH, DeploymentResult, PublishPayload } from './types'
import { Authenticator } from 'dcl-crypto'
import { getCurrentIdentity } from 'shared/session/selectors'
import { createGameFile } from './SceneStateDefinitionCodeGenerator'
import { ETHEREUM_NETWORK, BUILDER_SERVER_URL } from 'config'
import { BASE_BUILDER_SERVER_URL_ROPSTEN } from './BuilderServerAPIManager'
import { serializeSceneStateFromEntities } from 'scene-system/stateful-scene/SceneStateDefinitionSerializer'
import { blobToBuffer } from './SceneStateStorageController'
/**
 * We are converting from numeric ids to a more human readable format. It might make sense to change this in the future,
 * but until this feature is stable enough, it's better to store it in a way that it is easy to debug.
 */

const HUMAN_READABLE_TO_ID: Map<string, number> = new Map([
  ['Transform', CLASS_ID.TRANSFORM],
  ['GLTFShape', CLASS_ID.GLTF_SHAPE],
  ['NFTShape', CLASS_ID.NFT_SHAPE],
  ['Name', CLASS_ID.NAME],
  ['LockedOnEdit', CLASS_ID.LOCKED_ON_EDIT],
  ['VisibleOnEdit', CLASS_ID.VISIBLE_ON_EDIT],
  ['Script', CLASS_ID.SMART_ITEM]
])

export async function deployScene(payload: PublishPayload): Promise<DeploymentResult> {
  let result: DeploymentResult
  try {
    // Create content client
    const contentUrl = getFetchContentServer(store.getState())
    const contentClient = new ContentClient(contentUrl, 'builder in-world')

    // Build files
    const entityFiles: Map<string, Buffer> = new Map()
    for (const fileKey in payload.files) {
      entityFiles.set(fileKey, Buffer.from(JSON.stringify(payload.files[fileKey])))
    }

    // Decode those who need it
    for (const fileKey in payload.filesToDecode) {
      entityFiles.set(fileKey, await blobToBuffer(payload.filesToDecode[fileKey]))
    }

    // Prepare to get the assets
    const net = getSelectedNetwork(store.getState())
    const baseAssetUrl = net === ETHEREUM_NETWORK.MAINNET ? BUILDER_SERVER_URL : BASE_BUILDER_SERVER_URL_ROPSTEN

    // Get the assets
    const assetsRaw: BuilderAsset[] = payload.files[CONTENT_PATH.ASSETS] as unknown as BuilderAsset[]
    const assets = new Map<AssetId, Asset>()

    for (let i = 0; i < assetsRaw.length; i++) {
      const convertedAsset = builderAssetToLocalAsset(assetsRaw[i], baseAssetUrl)
      assets.set(convertedAsset.id, convertedAsset)
    }

    // Generate game file
    const gameFile: string = createGameFile(serializeSceneStateFromEntities(payload.statelessManifest.entities), assets)

    entityFiles.set(CONTENT_PATH.BUNDLED_GAME_FILE, Buffer.from(gameFile))

    // Build the entity
    const { files, entityId } = await contentClient.buildEntity({
      type: EntityType.SCENE,
      pointers: payload.pointers,
      files: entityFiles,
      metadata: payload.metadata
    })

    // Sign entity id
    const identity = getCurrentIdentity(store.getState())
    if (!identity) {
      throw new Error('Identity not found when trying to deploy an entity')
    }
    const authChain = Authenticator.signPayload(identity, entityId)

    // Deploy entity
    await contentClient.deployEntity({ files, entityId, authChain })

    result = { ok: true }
  } catch (error) {
    result = { ok: false, error: `${error}` }
  }
  return result
}

export function builderAssetToLocalAsset(webAsset: BuilderAsset, baseUrl: string): Asset {
  return {
    id: webAsset.id,
    model: webAsset.model,
    mappings: Object.entries(webAsset.contents).map(([file, hash]) => ({ file, hash })),
    baseUrl: `${baseUrl}/storage/contents`
  }
}

export function getUniqueNameForGLTF(currentNames: string[], gltfName: string, amountOfTimesAppear: number): string {
  let nameToReturn: string = gltfName

  nameToReturn = removesSpecialCharacters(nameToReturn, currentNames)

  if (amountOfTimesAppear > 1) nameToReturn = nameToReturn + amountOfTimesAppear

  for (let i = 0; i < currentNames.length; i++) {
    if (currentNames[i] === nameToReturn)
      nameToReturn = getUniqueNameForGLTF(currentNames, gltfName, amountOfTimesAppear + 1)
  }
  return nameToReturn
}

function removesSpecialCharacters(assetName: string, takenNames: string[]) {
  const parts = assetName.match(/[A-Za-z]+/g)
  const rawName = parts ? parts.map((part) => part.toLowerCase()).join('_') : 'entity'
  let entityName = rawName
  let count = 1
  const takenNamesSet = new Set(takenNames)
  while (takenNamesSet.has(entityName)) {
    entityName = `${rawName}_${++count}`
  }
  return entityName
}

export function camelize(str: string) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word: any, index: any) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase()
    })
    .replace(/\s+/g, '')
}

export function toHumanReadableType(type: number): string {
  const humanReadableType = Array.from(HUMAN_READABLE_TO_ID.entries())
    .filter(([, componentId]) => componentId === type)
    .map(([type]) => type)[0]
  if (!humanReadableType) {
    throw new Error(`Unknown type ${type}`)
  }
  return humanReadableType
}

export function fromHumanReadableType(humanReadableType: string): number {
  const type = HUMAN_READABLE_TO_ID.get(humanReadableType)
  if (!type) {
    throw new Error(`Unknown human readable type ${humanReadableType}`)
  }
  return type
}

export function getLayoutFromParcels(parcels: string[]): SceneSourcePlacement['layout'] {
  let rows = 1
  let cols = 1

  if (parcels.length > 1) {
    rows = [...new Set(parcels.map((parcel) => parcel.split(',')[1]))].length
    cols = [...new Set(parcels.map((parcel) => parcel.split(',')[0]))].length
  }
  return { cols, rows }
}
