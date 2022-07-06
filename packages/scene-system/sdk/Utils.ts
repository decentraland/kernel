import { Quaternion, Vector3 } from '@dcl/ecs-math'
import type { CLASS_ID, Transform } from '@dcl/legacy-ecs/dist/decentraland/Components'
import { EAType } from 'shared/apis/proto/EngineAPI.gen'
import { PBTransform } from 'shared/proto/engineinterface.gen'

const VECTOR3_MEMBER_CAP = 1000000 // Value measured when genesis plaza glitch triggered a physics engine breakdown
const pbTransform = {
  position: new Vector3(),
  rotation: new Quaternion(),
  scale: new Vector3()
} as const

const TRANSFORM_CLASS_ID = 1

export function generatePBObject(classId: CLASS_ID, json: string): string {
  if (classId === TRANSFORM_CLASS_ID) {
    const transform: Transform = JSON.parse(json)
    return serializeTransform(transform)
  }

  return json
}

export function generatePBObjectJSON(classId: CLASS_ID, json: any): string {
  if (classId === TRANSFORM_CLASS_ID) {
    return serializeTransform(json)
  }
  return JSON.stringify(json)
}

function serializeTransform(transform: Transform): string {
  // Position
  // If we don't cap these vectors, scenes may trigger a physics breakdown when messaging enormous values
  pbTransform.position.set(
    Math.fround(transform.position.x),
    Math.fround(transform.position.y),
    Math.fround(transform.position.z)
  )
  capVector(pbTransform.position, VECTOR3_MEMBER_CAP)

  // Rotation
  pbTransform.rotation.copyFrom(transform.rotation)

  // Scale
  pbTransform.scale.set(
    Math.fround(transform.scale.x),
    Math.fround(transform.scale.y),
    Math.fround(transform.scale.z)
  )
  capVector(pbTransform.scale, VECTOR3_MEMBER_CAP)

  const arrayBuffer: Uint8Array = PBTransform.encode(pbTransform).finish()
  return btoa(String.fromCharCode(...arrayBuffer))
}

function capVector(targetVector: Vector3, cap: number) {
  if (Math.abs(targetVector.x) > cap) {
    targetVector.x = cap * Math.sign(targetVector.x)
  }

  if (Math.abs(targetVector.y) > cap) {
    targetVector.y = cap * Math.sign(targetVector.y)
  }

  if (Math.abs(targetVector.z) > cap) {
    targetVector.z = cap * Math.sign(targetVector.z)
  }
}

const dataUrlRE = /^data:[^/]+\/[^;]+;base64,/
const blobRE = /^blob:http/

export const componentNameRE = /^(engine\.)/

export function resolveMapping(mapping: string | undefined, mappingName: string, baseUrl: string) {
  let url = mappingName

  if (mapping) {
    url = mapping
  }

  if (dataUrlRE.test(url)) {
    return url
  }

  if (blobRE.test(url)) {
    return url
  }

  return (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/') + url
}

// NOTE(Brian): The idea is to map all string ids used by this scene to ints
//              so we avoid sending/processing big ids like "xxxxx-xxxxx-xxxxx-xxxxx"
//              that are used by i.e. raycasting queries.
const idToNumberStore: Record<string, number> = {}
export const numberToIdStore: Record<number, string> = {}
let idToNumberStoreCounter: number = 10 // Starting in 10, to leave room for special cases (such as the root entity)

function addIdToStorage(id: string, idAsNumber: number) {
  idToNumberStore[id] = idAsNumber
  numberToIdStore[idAsNumber] = id
}

export function getIdAsNumber(id: string): number {
  if (!idToNumberStore.hasOwnProperty(id)) {
    idToNumberStoreCounter++
    addIdToStorage(id, idToNumberStoreCounter)
    return idToNumberStoreCounter
  } else {
    return idToNumberStore[id]
  }
}

export function initMessagesFinished() {
  return {
    type: EAType.InitMessagesFinished,
    tag: 'scene',
    payload: { initMessagesFinished: {} }
  }
}
