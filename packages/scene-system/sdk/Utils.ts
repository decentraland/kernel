import { Vector3 } from '@dcl/ecs-math'
import { CLASS_ID, Transform } from '@dcl/legacy-ecs'
import { PB_Transform, PB_Vector3, PB_Quaternion } from '../../shared/proto/engineinterface_pb'

const VECTOR3_MEMBER_CAP = 1000000 // Value measured when genesis plaza glitch triggered a physics engine breakdown
const pbTransform: PB_Transform = new PB_Transform()
const pbPosition: PB_Vector3 = new PB_Vector3()
const pbRotation: PB_Quaternion = new PB_Quaternion()
const pbScale: PB_Vector3 = new PB_Vector3()

export function generatePBObject(classId: CLASS_ID, json: string): string {
  if (classId === CLASS_ID.TRANSFORM) {
    const transform: Transform = JSON.parse(json)
    return serializeTransform(transform)
  }

  return json
}

export function generatePBObjectJSON(classId: CLASS_ID, json: any): string {
  if (classId === CLASS_ID.TRANSFORM) {
    return serializeTransform(json)
  }
  return JSON.stringify(json)
}

function serializeTransform(transform: Transform): string {
  // Position
  // If we don't cap these vectors, scenes may trigger a physics breakdown when messaging enormous values
  const cappedVector = new Vector3(
    Math.fround(transform.position.x),
    Math.fround(transform.position.y),
    Math.fround(transform.position.z)
  )
  capVector(cappedVector, VECTOR3_MEMBER_CAP)
  pbPosition.setX(cappedVector.x)
  pbPosition.setY(cappedVector.y)
  pbPosition.setZ(cappedVector.z)

  // Rotation
  pbRotation.setX(transform.rotation.x)
  pbRotation.setY(transform.rotation.y)
  pbRotation.setZ(transform.rotation.z)
  pbRotation.setW(transform.rotation.w)

  // Scale
  cappedVector.set(Math.fround(transform.scale.x), Math.fround(transform.scale.y), Math.fround(transform.scale.z))
  capVector(cappedVector, VECTOR3_MEMBER_CAP)
  pbScale.setX(cappedVector.x)
  pbScale.setY(cappedVector.y)
  pbScale.setZ(cappedVector.z)

  // Apply values
  pbTransform.setPosition(pbPosition)
  pbTransform.setRotation(pbRotation)
  pbTransform.setScale(pbScale)

  const arrayBuffer: Uint8Array = pbTransform.serializeBinary()
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
    type: 'InitMessagesFinished',
    tag: 'scene',
    payload: '{}'
  }
}
