/* eslint-disable */
import Long from 'long'
import * as _m0 from 'protobufjs/minimal'

export const protobufPackage = 'protocol'

export interface Position3DMessage {
  x: number
  y: number
  z: number
}

export interface HeartbeatMessage {
  position: Position3DMessage | undefined
}

export interface IslandChangedMessage {
  islandId: string
  connStr: string
  fromIslandId?: string | undefined
  peers: { [key: string]: Position3DMessage }
}

export interface IslandChangedMessage_PeersEntry {
  key: string
  value: Position3DMessage | undefined
}

export interface LeftIslandMessage {
  islandId: string
  peerId: string
}

export interface JoinIslandMessage {
  islandId: string
  peerId: string
}

function createBasePosition3DMessage(): Position3DMessage {
  return { x: 0, y: 0, z: 0 }
}

export const Position3DMessage = {
  encode(message: Position3DMessage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.x !== 0) {
      writer.uint32(9).double(message.x)
    }
    if (message.y !== 0) {
      writer.uint32(17).double(message.y)
    }
    if (message.z !== 0) {
      writer.uint32(25).double(message.z)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Position3DMessage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBasePosition3DMessage()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.x = reader.double()
          break
        case 2:
          message.y = reader.double()
          break
        case 3:
          message.z = reader.double()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): Position3DMessage {
    return {
      x: isSet(object.x) ? Number(object.x) : 0,
      y: isSet(object.y) ? Number(object.y) : 0,
      z: isSet(object.z) ? Number(object.z) : 0
    }
  },

  toJSON(message: Position3DMessage): unknown {
    const obj: any = {}
    message.x !== undefined && (obj.x = message.x)
    message.y !== undefined && (obj.y = message.y)
    message.z !== undefined && (obj.z = message.z)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<Position3DMessage>, I>>(object: I): Position3DMessage {
    const message = createBasePosition3DMessage()
    message.x = object.x ?? 0
    message.y = object.y ?? 0
    message.z = object.z ?? 0
    return message
  }
}

function createBaseHeartbeatMessage(): HeartbeatMessage {
  return { position: undefined }
}

export const HeartbeatMessage = {
  encode(message: HeartbeatMessage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.position !== undefined) {
      Position3DMessage.encode(message.position, writer.uint32(10).fork()).ldelim()
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): HeartbeatMessage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseHeartbeatMessage()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.position = Position3DMessage.decode(reader, reader.uint32())
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): HeartbeatMessage {
    return {
      position: isSet(object.position) ? Position3DMessage.fromJSON(object.position) : undefined
    }
  },

  toJSON(message: HeartbeatMessage): unknown {
    const obj: any = {}
    message.position !== undefined &&
      (obj.position = message.position ? Position3DMessage.toJSON(message.position) : undefined)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<HeartbeatMessage>, I>>(object: I): HeartbeatMessage {
    const message = createBaseHeartbeatMessage()
    message.position =
      object.position !== undefined && object.position !== null
        ? Position3DMessage.fromPartial(object.position)
        : undefined
    return message
  }
}

function createBaseIslandChangedMessage(): IslandChangedMessage {
  return { islandId: '', connStr: '', fromIslandId: undefined, peers: {} }
}

export const IslandChangedMessage = {
  encode(message: IslandChangedMessage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.islandId !== '') {
      writer.uint32(10).string(message.islandId)
    }
    if (message.connStr !== '') {
      writer.uint32(18).string(message.connStr)
    }
    if (message.fromIslandId !== undefined) {
      writer.uint32(26).string(message.fromIslandId)
    }
    Object.entries(message.peers).forEach(([key, value]) => {
      IslandChangedMessage_PeersEntry.encode({ key: key as any, value }, writer.uint32(34).fork()).ldelim()
    })
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): IslandChangedMessage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseIslandChangedMessage()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.islandId = reader.string()
          break
        case 2:
          message.connStr = reader.string()
          break
        case 3:
          message.fromIslandId = reader.string()
          break
        case 4:
          const entry4 = IslandChangedMessage_PeersEntry.decode(reader, reader.uint32())
          if (entry4.value !== undefined) {
            message.peers[entry4.key] = entry4.value
          }
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): IslandChangedMessage {
    return {
      islandId: isSet(object.islandId) ? String(object.islandId) : '',
      connStr: isSet(object.connStr) ? String(object.connStr) : '',
      fromIslandId: isSet(object.fromIslandId) ? String(object.fromIslandId) : undefined,
      peers: isObject(object.peers)
        ? Object.entries(object.peers).reduce<{ [key: string]: Position3DMessage }>((acc, [key, value]) => {
            acc[key] = Position3DMessage.fromJSON(value)
            return acc
          }, {})
        : {}
    }
  },

  toJSON(message: IslandChangedMessage): unknown {
    const obj: any = {}
    message.islandId !== undefined && (obj.islandId = message.islandId)
    message.connStr !== undefined && (obj.connStr = message.connStr)
    message.fromIslandId !== undefined && (obj.fromIslandId = message.fromIslandId)
    obj.peers = {}
    if (message.peers) {
      Object.entries(message.peers).forEach(([k, v]) => {
        obj.peers[k] = Position3DMessage.toJSON(v)
      })
    }
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<IslandChangedMessage>, I>>(object: I): IslandChangedMessage {
    const message = createBaseIslandChangedMessage()
    message.islandId = object.islandId ?? ''
    message.connStr = object.connStr ?? ''
    message.fromIslandId = object.fromIslandId ?? undefined
    message.peers = Object.entries(object.peers ?? {}).reduce<{ [key: string]: Position3DMessage }>(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = Position3DMessage.fromPartial(value)
        }
        return acc
      },
      {}
    )
    return message
  }
}

function createBaseIslandChangedMessage_PeersEntry(): IslandChangedMessage_PeersEntry {
  return { key: '', value: undefined }
}

export const IslandChangedMessage_PeersEntry = {
  encode(message: IslandChangedMessage_PeersEntry, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.key !== '') {
      writer.uint32(10).string(message.key)
    }
    if (message.value !== undefined) {
      Position3DMessage.encode(message.value, writer.uint32(18).fork()).ldelim()
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): IslandChangedMessage_PeersEntry {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseIslandChangedMessage_PeersEntry()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.key = reader.string()
          break
        case 2:
          message.value = Position3DMessage.decode(reader, reader.uint32())
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): IslandChangedMessage_PeersEntry {
    return {
      key: isSet(object.key) ? String(object.key) : '',
      value: isSet(object.value) ? Position3DMessage.fromJSON(object.value) : undefined
    }
  },

  toJSON(message: IslandChangedMessage_PeersEntry): unknown {
    const obj: any = {}
    message.key !== undefined && (obj.key = message.key)
    message.value !== undefined && (obj.value = message.value ? Position3DMessage.toJSON(message.value) : undefined)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<IslandChangedMessage_PeersEntry>, I>>(
    object: I
  ): IslandChangedMessage_PeersEntry {
    const message = createBaseIslandChangedMessage_PeersEntry()
    message.key = object.key ?? ''
    message.value =
      object.value !== undefined && object.value !== null ? Position3DMessage.fromPartial(object.value) : undefined
    return message
  }
}

function createBaseLeftIslandMessage(): LeftIslandMessage {
  return { islandId: '', peerId: '' }
}

export const LeftIslandMessage = {
  encode(message: LeftIslandMessage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.islandId !== '') {
      writer.uint32(10).string(message.islandId)
    }
    if (message.peerId !== '') {
      writer.uint32(18).string(message.peerId)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): LeftIslandMessage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseLeftIslandMessage()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.islandId = reader.string()
          break
        case 2:
          message.peerId = reader.string()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): LeftIslandMessage {
    return {
      islandId: isSet(object.islandId) ? String(object.islandId) : '',
      peerId: isSet(object.peerId) ? String(object.peerId) : ''
    }
  },

  toJSON(message: LeftIslandMessage): unknown {
    const obj: any = {}
    message.islandId !== undefined && (obj.islandId = message.islandId)
    message.peerId !== undefined && (obj.peerId = message.peerId)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<LeftIslandMessage>, I>>(object: I): LeftIslandMessage {
    const message = createBaseLeftIslandMessage()
    message.islandId = object.islandId ?? ''
    message.peerId = object.peerId ?? ''
    return message
  }
}

function createBaseJoinIslandMessage(): JoinIslandMessage {
  return { islandId: '', peerId: '' }
}

export const JoinIslandMessage = {
  encode(message: JoinIslandMessage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.islandId !== '') {
      writer.uint32(10).string(message.islandId)
    }
    if (message.peerId !== '') {
      writer.uint32(18).string(message.peerId)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): JoinIslandMessage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseJoinIslandMessage()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.islandId = reader.string()
          break
        case 2:
          message.peerId = reader.string()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): JoinIslandMessage {
    return {
      islandId: isSet(object.islandId) ? String(object.islandId) : '',
      peerId: isSet(object.peerId) ? String(object.peerId) : ''
    }
  },

  toJSON(message: JoinIslandMessage): unknown {
    const obj: any = {}
    message.islandId !== undefined && (obj.islandId = message.islandId)
    message.peerId !== undefined && (obj.peerId = message.peerId)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<JoinIslandMessage>, I>>(object: I): JoinIslandMessage {
    const message = createBaseJoinIslandMessage()
    message.islandId = object.islandId ?? ''
    message.peerId = object.peerId ?? ''
    return message
  }
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined

export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<DeepPartial<U>>
  : T extends { $case: string }
  ? { [K in keyof Omit<T, '$case'>]?: DeepPartial<T[K]> } & { $case: T['$case'] }
  : T extends {}
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>

type KeysOfUnion<T> = T extends T ? keyof T : never
export type Exact<P, I extends P> = P extends Builtin
  ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & Record<Exclude<keyof I, KeysOfUnion<P>>, never>

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any
  _m0.configure()
}

function isObject(value: any): boolean {
  return typeof value === 'object' && value !== null
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined
}
