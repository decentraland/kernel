import { CLASS_ID } from '@dcl/legacy-ecs'
import { SceneSourcePlacement } from 'shared/types'
import { Asset, BuilderAsset, SerializedSceneState } from './types'

import * as SSSCTypes from '../SceneStateStorageController/types'
import * as ProtoSceneStateStorageController from '../proto/SceneStateStorageController.gen'

/*
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
type Component = { type: number; value: any }
export function serializeSceneStateFromEntities(rawEntities: any): SerializedSceneState {
  const entities: { id: string; components: Component[] }[] = []
  for (let i = 0; i < rawEntities.length; i++) {
    const components: Component[] = []
    for (let z = 0; z < rawEntities[i].components.length; z++) {
      components.push({
        type: fromHumanReadableType(rawEntities[i].components[z].type),
        value: rawEntities[i].components[z].value
      })
    }
    entities.push({ id: rawEntities[i].id, components })
  }
  return { entities }
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

export function toProtoSerializedSceneState(
  state: SSSCTypes.SerializedSceneState
): ProtoSceneStateStorageController.SerializedSceneState {
  return {
    entities: state.entities.map((item) => ({
      id: item.id,
      components: item.components.map((component) => ({
        type: component.type,
        valueJson: JSON.stringify(component.value)
      }))
    }))
  }
}

export function fromProtoSerializedSceneState(
  state: ProtoSceneStateStorageController.SerializedSceneState
): SSSCTypes.SerializedSceneState {
  return {
    entities: state.entities.map((item) => ({
      id: item.id,
      components: item.components.map((component) => ({
        type: component.type,
        value: JSON.parse(component.valueJson)
      }))
    }))
  }
}
