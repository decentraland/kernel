import { ContentClient } from 'dcl-catalyst-client'
import { Pointer } from 'dcl-catalyst-commons'
import { getCurrentIdentity } from './../../session/selectors'
import { CLASS_ID } from '@dcl/legacy-ecs'
import { getFetchContentServer, getSelectedNetwork } from './../../dao/selectors'
import { ExplorerIdentity } from './../../session/types'
import { store } from './../../store/isolatedStore'

import { SceneStateDefinition } from './../../../scene-system/stateful-scene/SceneStateDefinition'
import { deserializeSceneState } from './../../../scene-system/stateful-scene/SceneStateDefinitionSerializer'

import {
  Asset,
  AssetId,
  BuilderAsset,
  CONTENT_PATH,
  SerializedSceneState
} from './../SceneStateStorageController/types'
import { toBuilderFromStateDefinitionFormat } from './../SceneStateStorageController/StorableSceneStateTranslation'
import { BuilderServerAPIManager } from './../SceneStateStorageController/BuilderServerAPIManager'
import { PortContext } from './../host/context'

export function getBuilderApiManager(ctx: PortContext): BuilderServerAPIManager {
  if (!ctx.SceneStateStorageController) {
    ctx.SceneStateStorageController = {
      _builderApiManager: null
    } as any
  }

  if (!ctx.SceneStateStorageController._builderApiManager) {
    const net = getSelectedNetwork(store.getState())
    ctx.SceneStateStorageController._builderApiManager = new BuilderServerAPIManager(net)
  }
  return ctx.SceneStateStorageController._builderApiManager
}

export function getIdentity(): ExplorerIdentity {
  const identity = getCurrentIdentity(store.getState())
  if (!identity) {
    throw new Error('Identity not found when trying to deploy an entity')
  }
  return identity
}

export async function getAllBuilderAssets(state: SerializedSceneState, ctx: PortContext): Promise<BuilderAsset[]> {
  const assetIds: Set<AssetId> = new Set()
  for (const entity of state.entities) {
    entity.components
      .filter(({ type, value }) => type === CLASS_ID.GLTF_SHAPE && value.assetId)
      .forEach(({ value }) => assetIds.add(value.assetId))
  }
  return getBuilderApiManager(ctx).getBuilderAssets([...assetIds])
}

export function getParcels(ctx: PortContext): Pointer[] {
  return ctx.ParcelIdentity.land!.sceneJsonData.scene.parcels
}

export function getContentClient(): ContentClient {
  const contentUrl = getFetchContentServer(store.getState())
  return new ContentClient({ contentUrl })
}

export function getAllAssets(state: SerializedSceneState, ctx: PortContext): Promise<Map<AssetId, Asset>> {
  const assetIds: Set<AssetId> = new Set()
  for (const entity of state.entities) {
    entity.components
      .filter(({ type, value }) => type === CLASS_ID.GLTF_SHAPE && value.assetId)
      .forEach(({ value }) => assetIds.add(value.assetId))
  }
  return getBuilderApiManager(ctx).getConvertedAssets([...assetIds])
}

export async function downloadAssetFiles(assets: Map<AssetId, Asset>): Promise<Map<string, Buffer>> {
  // Path to url map
  const allMappings: Map<string, string> = new Map()

  // Gather all mappings together
  for (const asset of assets.values()) {
    asset.mappings.forEach(({ file, hash }) =>
      allMappings.set(`${CONTENT_PATH.MODELS_FOLDER}/${file}`, `${asset.baseUrl}/${hash}`)
    )
  }

  // Download models
  const promises: Promise<[string, Buffer]>[] = Array.from(allMappings.entries()).map<Promise<[string, Buffer]>>(
    async ([path, url]) => {
      const response = await fetch(url)
      const buffer = Buffer.from(await response.arrayBuffer())
      return [path, buffer]
    }
  )

  const result = await Promise.all(promises)
  return new Map(result)
}

export async function updateProjectDetails(
  sceneState: SerializedSceneState,
  sceneName: string,
  sceneDescription: string,
  thumbnailBlob: Blob,
  ctx: PortContext
) {
  // Deserialize the scene state
  const deserializedSceneState: SceneStateDefinition = deserializeSceneState(sceneState)

  // Convert the scene state to builder scheme format
  const builderManifest = await toBuilderFromStateDefinitionFormat(
    deserializedSceneState,
    ctx.SceneStateStorageController.builderManifest,
    getBuilderApiManager(ctx),
    ctx.SceneStateStorageController.transformTranslator
  )

  // Update the project info
  builderManifest.project.title = sceneName
  builderManifest.project.description = sceneDescription

  // Update the manifest
  await getBuilderApiManager(ctx).updateProjectManifest(builderManifest, getIdentity())

  // Update the thumbnail
  await getBuilderApiManager(ctx).updateProjectThumbnail(builderManifest.project.id, thumbnailBlob, getIdentity())
}

// TODO: do not use blobs
// eslint-disable-next-line @typescript-eslint/no-var-requires
const toBuffer = require('blob-to-buffer')
export function blobToBuffer(blob: Blob): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    toBuffer(blob, (err: Error, buffer: Buffer) => {
      if (err) reject(err)
      resolve(buffer)
    })
  })
}
