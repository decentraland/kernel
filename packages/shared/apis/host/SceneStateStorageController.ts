import { EntityType, ContentFileHash } from 'dcl-catalyst-commons'
import { Authenticator } from 'dcl-crypto'

import { getFromPersistentStorage, saveToPersistentStorage } from './../../../atomicHelpers/persistentStorage'

import { defaultLogger } from '../../logger'
import { DEBUG } from '../../../config'
import { getCurrentIdentity } from './../../session/selectors'
import { uuid } from './../../../atomicHelpers/math'
import { base64ToBlob } from './../../../atomicHelpers/base64ToBlob'
import { getUnityInstance } from './../../../unity-interface/IUnityInterface'
import { store } from './../../store/isolatedStore'

import { SceneStateDefinition } from './../../../scene-system/stateful-scene/SceneStateDefinition'
import {
  deserializeSceneState,
  serializeSceneState
} from './../../../scene-system/stateful-scene/SceneStateDefinitionSerializer'

import {
  BuilderAsset,
  CONTENT_PATH,
  DeploymentResult,
  SceneDeploymentSourceMetadata
} from './../SceneStateStorageController/types'
import {
  fromBuildertoStateDefinitionFormat,
  fromSerializedStateToStorableFormat,
  fromStorableFormatToSerializedState,
  StorableSceneState,
  toBuilderFromStateDefinitionFormat
} from './../SceneStateStorageController/StorableSceneStateTranslation'
import { createGameFile } from './../SceneStateStorageController/SceneStateDefinitionCodeGenerator'
import { getLayoutFromParcels } from './../SceneStateStorageController/utils'
import { SceneTransformTranslator } from './../SceneStateStorageController/SceneTransformTranslator'

import { RpcServerPort } from '@dcl/rpc'
import { PortContextService } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'

import {
  CreateProjectFromStateDefinitionRequest,
  CreateProjectFromStateDefinitionResponse,
  CreateProjectWithCoordsRequest,
  CreateProjectWithCoordsResponse,
  GetProjectManifestByCoordinatesRequest,
  GetProjectManifestByCoordinatesResponse,
  GetProjectManifestRequest,
  GetProjectManifestResponse,
  GetStoredStateRequest,
  GetStoredStateResponse,
  PublishSceneStateRequest,
  PublishSceneStateResponse,
  SaveProjectInfoRequest,
  SaveProjectInfoResponse,
  SaveSceneStateRequest,
  SaveSceneStateResponse,
  SceneStateStorageControllerServiceDefinition,
  SendAssetsToRendererRequest,
  SendAssetsToRendererResponse
} from './../gen/SceneStateStorageController'

import { fromProtoSerializedSceneState, toProtoSerializedSceneState } from '../SceneStateStorageController/utils'
import {
  blobToBuffer,
  downloadAssetFiles,
  getAllAssets,
  getAllBuilderAssets,
  getBuilderApiManager,
  getContentClient,
  getIdentity,
  getParcels,
  updateProjectDetails
} from '../SceneStateStorageController/RPCHostUtils'

type ServiceContext = PortContextService<'SceneStateStorageController'>

async function getProjectManifest(
  req: GetProjectManifestRequest,
  ctx: ServiceContext
): Promise<GetProjectManifestResponse> {
  const manifest = await getBuilderApiManager(ctx).getBuilderManifestFromProjectId(req.projectId, getIdentity())
  if (!manifest) return { state: undefined }

  getUnityInstance().SendBuilderProjectInfo(manifest.project.title, manifest.project.description, false)

  ctx.SceneStateStorageController.builderManifest = manifest
  ctx.SceneStateStorageController.transformTranslator = new SceneTransformTranslator(
    ctx.ParcelIdentity.land!.sceneJsonData.source
  )

  const definition = fromBuildertoStateDefinitionFormat(
    manifest.scene,
    ctx.SceneStateStorageController.transformTranslator
  )
  return { state: toProtoSerializedSceneState(serializeSceneState(definition)) }
}

async function getProjectManifestByCoordinates(
  req: GetProjectManifestByCoordinatesRequest,
  ctx: ServiceContext
): Promise<GetProjectManifestByCoordinatesResponse> {
  const newProject = await getBuilderApiManager(ctx).getBuilderManifestFromLandCoordinates(req.land, getIdentity())
  if (newProject) {
    getUnityInstance().SendBuilderProjectInfo(newProject.project.title, newProject.project.description, false)
    ctx.SceneStateStorageController.builderManifest = newProject
    ctx.SceneStateStorageController.transformTranslator = new SceneTransformTranslator(
      ctx.ParcelIdentity.land!.sceneJsonData.source
    )
    const translatedManifest = fromBuildertoStateDefinitionFormat(
      ctx.SceneStateStorageController.builderManifest.scene,
      ctx.SceneStateStorageController.transformTranslator
    )
    return { state: toProtoSerializedSceneState(serializeSceneState(translatedManifest)) }
  }
  return { state: undefined }
}

async function createProjectWithCoords(
  req: CreateProjectWithCoordsRequest,
  ctx: ServiceContext
): Promise<CreateProjectWithCoordsResponse> {
  const newProject = await getBuilderApiManager(ctx).createProjectWithCoords(req.coordinates, getIdentity())
  getUnityInstance().SendBuilderProjectInfo(newProject.project.title, newProject.project.description, true)
  ctx.SceneStateStorageController.builderManifest = newProject
  ctx.SceneStateStorageController.transformTranslator = new SceneTransformTranslator(
    ctx.ParcelIdentity.land!.sceneJsonData.source
  )
  return { ok: newProject ? true : false }
}

async function saveSceneState(req: SaveSceneStateRequest, ctx: ServiceContext): Promise<SaveSceneStateResponse> {
  let result: SaveSceneStateResponse

  try {
    // Deserialize the scene state
    const sceneState: SceneStateDefinition = deserializeSceneState(
      fromProtoSerializedSceneState(req.serializedSceneState!)
    )

    // Convert the scene state to builder scheme format
    const builderManifest = await toBuilderFromStateDefinitionFormat(
      sceneState,
      ctx.SceneStateStorageController.builderManifest,
      getBuilderApiManager(ctx),
      ctx.SceneStateStorageController.transformTranslator
    )

    // Update the manifest
    await getBuilderApiManager(ctx).updateProjectManifest(builderManifest, getIdentity())
    result = { ok: true }
  } catch (error) {
    defaultLogger.error('Saving manifest failed', error)
    result = { ok: false, error: `${error}` }
  }
  return result
}

async function saveProjectInfo(req: SaveProjectInfoRequest, ctx: ServiceContext): Promise<SaveProjectInfoResponse> {
  let result: boolean
  try {
    const thumbnailBlob: Blob = base64ToBlob(req.projectScreenshot, 'image/png')
    await updateProjectDetails(
      fromProtoSerializedSceneState(req.sceneState!),
      req.projectName,
      req.projectDescription,
      thumbnailBlob,
      ctx
    )
    result = true
  } catch (error) {
    defaultLogger.error('Project details updating failed', error)
    result = false
  }

  return { ok: result }
}

async function publishSceneState(
  req: PublishSceneStateRequest,
  ctx: ServiceContext
): Promise<PublishSceneStateResponse> {
  let result: DeploymentResult

  const sceneState = fromProtoSerializedSceneState(req.sceneState!)
  // Convert to storable format
  const storableFormat = fromSerializedStateToStorableFormat(sceneState)

  if (DEBUG) {
    await saveToPersistentStorage(`scene-state-${req.sceneId}`, storableFormat)
    result = { ok: true }
  } else {
    try {
      const thumbnailBlob: Blob = base64ToBlob(req.sceneScreenshot, 'image/png')

      // Fetch all asset metadata
      const assets = await getAllAssets(sceneState, ctx)

      const assetsArray = await getAllBuilderAssets(sceneState, ctx)

      // Download asset files
      const models = await downloadAssetFiles(assets)

      // Generate game file
      const gameFile: string = createGameFile(sceneState, assets)

      // Prepare scene.json
      const sceneJson = ctx.ParcelIdentity.land!.sceneJsonData
      sceneJson.display = {
        title: req.sceneName,
        description: req.sceneDescription,
        navmapThumbnail: CONTENT_PATH.SCENE_THUMBNAIL
      }

      // Group all entity files
      const entityFiles: Map<string, Buffer> = new Map([
        [CONTENT_PATH.DEFINITION_FILE, Buffer.from(JSON.stringify(storableFormat))],
        [CONTENT_PATH.BUNDLED_GAME_FILE, Buffer.from(gameFile)],
        [CONTENT_PATH.SCENE_FILE, Buffer.from(JSON.stringify(sceneJson))],
        [CONTENT_PATH.SCENE_THUMBNAIL, await blobToBuffer(thumbnailBlob)],
        [CONTENT_PATH.ASSETS, Buffer.from(JSON.stringify(assetsArray))],
        ...models
      ])

      // Deploy
      const contentClient = getContentClient()

      // Build the entity
      const parcels = getParcels(ctx)
      const { files, entityId } = await contentClient.buildEntity({
        type: EntityType.SCENE,
        pointers: parcels,
        files: entityFiles,
        metadata: {
          ...sceneJson,
          source: {
            origin: 'builder-in-world',
            version: 1,
            projectId: ctx.SceneStateStorageController.builderManifest.project.id,
            rotation: ctx.ParcelIdentity.land!.sceneJsonData.source?.rotation ?? 'east',
            layout: ctx.ParcelIdentity.land!.sceneJsonData.source?.layout ?? getLayoutFromParcels(parcels),
            point:
              ctx.ParcelIdentity.land!.sceneJsonData.source?.point ?? ctx.ParcelIdentity.land!.sceneJsonData.scene.base
          } as SceneDeploymentSourceMetadata
        }
      })

      // Sign entity id
      const identity = getCurrentIdentity(store.getState())
      if (!identity) {
        throw new Error('Identity not found when trying to deploy an entity')
      }
      const authChain = Authenticator.signPayload(identity, entityId)

      await contentClient.deployEntity({ files, entityId, authChain })

      // Update the project name, desc and thumbnail. unlink coordinates from builder project
      ctx.SceneStateStorageController.builderManifest.project.creation_coords = undefined
      await updateProjectDetails(sceneState, req.sceneName, req.sceneDescription, thumbnailBlob, ctx)

      result = { ok: true }
    } catch (error) {
      defaultLogger.error('Deployment failed', error)
      result = { ok: false, error: `${error}` }
    }
  }
  getUnityInstance().SendPublishSceneResult(result)
  return result
}

async function getStoredState(req: GetStoredStateRequest, ctx: ServiceContext): Promise<GetStoredStateResponse> {
  if (DEBUG) {
    const sceneState: StorableSceneState = await getFromPersistentStorage(`scene-state-${req.sceneId}`)
    if (sceneState) {
      return { state: toProtoSerializedSceneState(fromStorableFormatToSerializedState(sceneState)) }
    }
    defaultLogger.warn(`Couldn't find a local scene state for scene ${req.sceneId}`)
    // NOTE: RPC controllers should NEVER return undefined. Use null instead
    return { state: undefined }
  }

  const contentClient = getContentClient()
  try {
    // Fetch the entity and find the definition's hash
    const scene = await contentClient.fetchEntityById(EntityType.SCENE, ctx.ParcelIdentity.cid, { attempts: 3 })
    const definitionHash: ContentFileHash | undefined = scene.content?.find(
      ({ file }) => file === CONTENT_PATH.DEFINITION_FILE
    )?.hash

    if (definitionHash) {
      // Download the definition and return it
      const definitionBuffer = await contentClient.downloadContent(definitionHash, { attempts: 3 })
      const definitionFile = JSON.parse(definitionBuffer.toString())
      return { state: toProtoSerializedSceneState(fromStorableFormatToSerializedState(definitionFile)) }
    } else {
      defaultLogger.warn(
        `Couldn't find a definition file on the content server for the current scene (${ctx.ParcelIdentity.cid})`
      )
    }
  } catch (e) {
    defaultLogger.error(`Failed to fetch the current scene (${ctx.ParcelIdentity.cid}) from the content server`, e)
  }
  return { state: undefined }
}

async function createProjectFromStateDefinition(
  req: CreateProjectFromStateDefinitionRequest,
  ctx: ServiceContext
): Promise<CreateProjectFromStateDefinitionResponse> {
  const sceneJson = ctx.ParcelIdentity.land!.sceneJsonData
  const sceneId: string = ctx.ParcelIdentity.land!.sceneId
  const baseParcel: string = sceneJson.scene.base
  const parcels: string[] = sceneJson.scene.parcels
  const title: string | undefined = sceneJson.display?.title
  const description: string | undefined = sceneJson.display?.description

  try {
    const serializedSceneResponse = await getStoredState({ sceneId }, ctx)
    if (serializedSceneResponse.state) {
      const serializedScene = fromProtoSerializedSceneState(serializedSceneResponse.state)
      const identity = getIdentity()
      const contentClient = getContentClient()

      const assetsFileHash: string | undefined = ctx.ParcelIdentity.land!.mappingsResponse.contents.find(
        (pair) => pair.file === CONTENT_PATH.ASSETS
      )?.hash
      if (assetsFileHash) {
        const assetJson = await contentClient.downloadContent(assetsFileHash, { attempts: 3 })

        if (assetJson) {
          const assets: BuilderAsset[] = JSON.parse(assetJson.toString())
          getBuilderApiManager(ctx).addBuilderAssets(assets)
        }
      }

      // Create builder manifest from serialized scene
      const builderManifest = await getBuilderApiManager(ctx).builderManifestFromSerializedState(
        uuid(),
        uuid(),
        baseParcel,
        parcels,
        title,
        description,
        identity.rawAddress,
        serializedScene,
        ctx.ParcelIdentity.land!.sceneJsonData.source?.layout
      )

      if (builderManifest) {
        // Transform manifest components
        ctx.SceneStateStorageController.transformTranslator = new SceneTransformTranslator(
          ctx.ParcelIdentity.land!.sceneJsonData.source
        )

        builderManifest.scene.components = Object.entries(builderManifest.scene.components).reduce(
          (acc, [k, v]) => ({
            ...acc,
            [k]: ctx.SceneStateStorageController.transformTranslator.transformBuilderComponent(v)
          }),
          {}
        )

        // Notify renderer about the project information
        getUnityInstance().SendBuilderProjectInfo(
          builderManifest.project.title,
          builderManifest.project.description,
          false
        )

        // Update/Create manifest in builder-server
        ctx.SceneStateStorageController.builderManifest = builderManifest
        getBuilderApiManager(ctx)
          .updateProjectManifest(builderManifest, identity)
          .catch((error) => defaultLogger.error(`Error updating project manifest ${error}`))

        // Retrieve deployed thumbnail
        const thumbnailHash: string | undefined = ctx.ParcelIdentity.land!.mappingsResponse.contents.find(
          (pair) => pair.file === CONTENT_PATH.SCENE_THUMBNAIL
        )?.hash
        let thumbnail: string = ''
        if (thumbnailHash) {
          const thumbnailBuffer = await contentClient.downloadContent(thumbnailHash, { attempts: 3 })
          thumbnail = thumbnailBuffer.toString('base64')
        }

        const protoSerializedSceneState = toProtoSerializedSceneState(serializedScene)
        // Publish scene
        publishSceneState(
          {
            sceneId,
            sceneName: builderManifest.project.title,
            sceneDescription: builderManifest.project.description,
            sceneScreenshot: thumbnail,
            sceneState: protoSerializedSceneState
          },
          ctx
        ).catch((error) => defaultLogger.error(`Error publishing scene ${error}`))

        return { state: protoSerializedSceneState }
      }
    }
  } catch (error) {
    defaultLogger.error(`Failed creating project from state definition at coords ${baseParcel}`, error)
  }
  return { state: undefined }
}

async function sendAssetsToRenderer(
  req: SendAssetsToRendererRequest,
  ctx: ServiceContext
): Promise<SendAssetsToRendererResponse> {
  const assets = await getAllBuilderAssets(fromProtoSerializedSceneState(req.state!), ctx)
  getUnityInstance().SendSceneAssets(assets)
  return { state: 'OK' }
}

export function registerSceneStateStorageControllerServiceServerImplementation(
  port: RpcServerPort<PortContextService<'SceneStateStorageController'>>
) {
  codegen.registerService(port, SceneStateStorageControllerServiceDefinition, async () => ({
    getProjectManifest,
    getProjectManifestByCoordinates,
    createProjectWithCoords,
    saveSceneState,
    saveProjectInfo,
    publishSceneState,
    getStoredState,
    createProjectFromStateDefinition,
    sendAssetsToRenderer
  }))
}
