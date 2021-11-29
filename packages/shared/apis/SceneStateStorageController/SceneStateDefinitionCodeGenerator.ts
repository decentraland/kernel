import { LightweightWriter } from 'dcl-scene-writer'
import { Vector3, Quaternion } from '@dcl/ecs-math'
import * as ECS from 'decentraland-ecs'
import { SerializedSceneState, CONTENT_PATH, Asset, AssetId } from './types'

export function createGameFile(state: SerializedSceneState, assets: Map<AssetId, Asset>): string {
  const writer = new LightweightWriter(ECS)
  for (const entity of state.entities) {
    const ecsEntity = new ECS.Entity()
    let entityName = entity.id

    for (const component of entity.components) {
      switch (component.type) {
        case ECS.CLASS_ID.TRANSFORM:
          const { position, rotation, scale } = component.value
          ecsEntity.addComponentOrReplace(
            new ECS.Transform({
              position: new Vector3(position.x, position.y, position.z) as any,
              rotation: new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w) as any,
              scale: new Vector3(scale.x, scale.y, scale.z) as any
            })
          )
          break
        case ECS.CLASS_ID.GLTF_SHAPE:
          const { assetId } = component.value
          const asset: Asset | undefined = assetId ? assets.get(assetId) : undefined
          if (asset) {
            ecsEntity.addComponentOrReplace(new ECS.GLTFShape(`${CONTENT_PATH.MODELS_FOLDER}/${asset.model}`))
          }
          break
        case ECS.CLASS_ID.NFT_SHAPE:
          const { src, style, color } = component.value
          ecsEntity.addComponentOrReplace(new ECS.NFTShape(src, { style, color }))
          break
        case ECS.CLASS_ID.NAME:
          const { value } = component.value
          entityName = value
          break
      }
    }
    writer.addEntity(entityName, ecsEntity)
  }
  return writer.emitCode()
}
