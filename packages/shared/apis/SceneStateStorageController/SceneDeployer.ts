import { store } from 'shared/store/isolatedStore'
import { getFetchContentServer, getSelectedNetwork } from 'shared/dao/selectors'
import { ContentClient } from 'dcl-catalyst-client'
import { EntityType } from 'dcl-catalyst-commons'
import { Asset, AssetId, BuilderAsset, CONTENT_PATH, PublishPayload } from './types'
import { Authenticator } from 'dcl-crypto'
import { createGameFile } from './SceneStateDefinitionCodeGenerator'
import { BASE_BUILDER_SERVER_URL_ROPSTEN } from './BuilderServerAPIManager'
import { builderAssetToLocalAsset, serializeSceneStateFromEntities } from './utils'
import { getCurrentIdentity } from 'shared/session/selectors'
import { BUILDER_SERVER_URL, ETHEREUM_NETWORK } from 'config'

export async function deployScene(payload: PublishPayload) {
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
      entityFiles.set(fileKey, Buffer.from(payload.filesToDecode[fileKey], 'base64'))
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
  } catch (error) {
    throw error
  }
}
