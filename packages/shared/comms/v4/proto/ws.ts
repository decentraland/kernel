/* eslint-disable */
import Long from 'long'
import * as _m0 from 'protobufjs/minimal'

export const protobufPackage = 'protocol'

export interface WsWelcome {
  alias: number
}

export interface WsSystem {
  fromAlias: number
  body: Uint8Array
}

export interface WsIdentity {
  fromAlias: number
  identity: string
  body: Uint8Array
}

export interface WsMessage {
  data?:
    | { $case: 'welcomeMessage'; welcomeMessage: WsWelcome }
    | { $case: 'systemMessage'; systemMessage: WsSystem }
    | { $case: 'identityMessage'; identityMessage: WsIdentity }
}

function createBaseWsWelcome(): WsWelcome {
  return { alias: 0 }
}

export const WsWelcome = {
  encode(message: WsWelcome, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.alias !== 0) {
      writer.uint32(8).uint64(message.alias)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WsWelcome {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseWsWelcome()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.alias = longToNumber(reader.uint64() as Long)
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): WsWelcome {
    return {
      alias: isSet(object.alias) ? Number(object.alias) : 0
    }
  },

  toJSON(message: WsWelcome): unknown {
    const obj: any = {}
    message.alias !== undefined && (obj.alias = Math.round(message.alias))
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<WsWelcome>, I>>(object: I): WsWelcome {
    const message = createBaseWsWelcome()
    message.alias = object.alias ?? 0
    return message
  }
}

function createBaseWsSystem(): WsSystem {
  return { fromAlias: 0, body: new Uint8Array() }
}

export const WsSystem = {
  encode(message: WsSystem, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fromAlias !== 0) {
      writer.uint32(8).uint64(message.fromAlias)
    }
    if (message.body.length !== 0) {
      writer.uint32(18).bytes(message.body)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WsSystem {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseWsSystem()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.fromAlias = longToNumber(reader.uint64() as Long)
          break
        case 2:
          message.body = reader.bytes()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): WsSystem {
    return {
      fromAlias: isSet(object.fromAlias) ? Number(object.fromAlias) : 0,
      body: isSet(object.body) ? bytesFromBase64(object.body) : new Uint8Array()
    }
  },

  toJSON(message: WsSystem): unknown {
    const obj: any = {}
    message.fromAlias !== undefined && (obj.fromAlias = Math.round(message.fromAlias))
    message.body !== undefined &&
      (obj.body = base64FromBytes(message.body !== undefined ? message.body : new Uint8Array()))
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<WsSystem>, I>>(object: I): WsSystem {
    const message = createBaseWsSystem()
    message.fromAlias = object.fromAlias ?? 0
    message.body = object.body ?? new Uint8Array()
    return message
  }
}

function createBaseWsIdentity(): WsIdentity {
  return { fromAlias: 0, identity: '', body: new Uint8Array() }
}

export const WsIdentity = {
  encode(message: WsIdentity, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fromAlias !== 0) {
      writer.uint32(8).uint64(message.fromAlias)
    }
    if (message.identity !== '') {
      writer.uint32(18).string(message.identity)
    }
    if (message.body.length !== 0) {
      writer.uint32(26).bytes(message.body)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WsIdentity {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseWsIdentity()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.fromAlias = longToNumber(reader.uint64() as Long)
          break
        case 2:
          message.identity = reader.string()
          break
        case 3:
          message.body = reader.bytes()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): WsIdentity {
    return {
      fromAlias: isSet(object.fromAlias) ? Number(object.fromAlias) : 0,
      identity: isSet(object.identity) ? String(object.identity) : '',
      body: isSet(object.body) ? bytesFromBase64(object.body) : new Uint8Array()
    }
  },

  toJSON(message: WsIdentity): unknown {
    const obj: any = {}
    message.fromAlias !== undefined && (obj.fromAlias = Math.round(message.fromAlias))
    message.identity !== undefined && (obj.identity = message.identity)
    message.body !== undefined &&
      (obj.body = base64FromBytes(message.body !== undefined ? message.body : new Uint8Array()))
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<WsIdentity>, I>>(object: I): WsIdentity {
    const message = createBaseWsIdentity()
    message.fromAlias = object.fromAlias ?? 0
    message.identity = object.identity ?? ''
    message.body = object.body ?? new Uint8Array()
    return message
  }
}

function createBaseWsMessage(): WsMessage {
  return { data: undefined }
}

export const WsMessage = {
  encode(message: WsMessage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.data?.$case === 'welcomeMessage') {
      WsWelcome.encode(message.data.welcomeMessage, writer.uint32(10).fork()).ldelim()
    }
    if (message.data?.$case === 'systemMessage') {
      WsSystem.encode(message.data.systemMessage, writer.uint32(18).fork()).ldelim()
    }
    if (message.data?.$case === 'identityMessage') {
      WsIdentity.encode(message.data.identityMessage, writer.uint32(26).fork()).ldelim()
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): WsMessage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseWsMessage()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.data = { $case: 'welcomeMessage', welcomeMessage: WsWelcome.decode(reader, reader.uint32()) }
          break
        case 2:
          message.data = { $case: 'systemMessage', systemMessage: WsSystem.decode(reader, reader.uint32()) }
          break
        case 3:
          message.data = { $case: 'identityMessage', identityMessage: WsIdentity.decode(reader, reader.uint32()) }
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): WsMessage {
    return {
      data: isSet(object.welcomeMessage)
        ? { $case: 'welcomeMessage', welcomeMessage: WsWelcome.fromJSON(object.welcomeMessage) }
        : isSet(object.systemMessage)
        ? { $case: 'systemMessage', systemMessage: WsSystem.fromJSON(object.systemMessage) }
        : isSet(object.identityMessage)
        ? { $case: 'identityMessage', identityMessage: WsIdentity.fromJSON(object.identityMessage) }
        : undefined
    }
  },

  toJSON(message: WsMessage): unknown {
    const obj: any = {}
    message.data?.$case === 'welcomeMessage' &&
      (obj.welcomeMessage = message.data?.welcomeMessage ? WsWelcome.toJSON(message.data?.welcomeMessage) : undefined)
    message.data?.$case === 'systemMessage' &&
      (obj.systemMessage = message.data?.systemMessage ? WsSystem.toJSON(message.data?.systemMessage) : undefined)
    message.data?.$case === 'identityMessage' &&
      (obj.identityMessage = message.data?.identityMessage
        ? WsIdentity.toJSON(message.data?.identityMessage)
        : undefined)
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<WsMessage>, I>>(object: I): WsMessage {
    const message = createBaseWsMessage()
    if (
      object.data?.$case === 'welcomeMessage' &&
      object.data?.welcomeMessage !== undefined &&
      object.data?.welcomeMessage !== null
    ) {
      message.data = { $case: 'welcomeMessage', welcomeMessage: WsWelcome.fromPartial(object.data.welcomeMessage) }
    }
    if (
      object.data?.$case === 'systemMessage' &&
      object.data?.systemMessage !== undefined &&
      object.data?.systemMessage !== null
    ) {
      message.data = { $case: 'systemMessage', systemMessage: WsSystem.fromPartial(object.data.systemMessage) }
    }
    if (
      object.data?.$case === 'identityMessage' &&
      object.data?.identityMessage !== undefined &&
      object.data?.identityMessage !== null
    ) {
      message.data = { $case: 'identityMessage', identityMessage: WsIdentity.fromPartial(object.data.identityMessage) }
    }
    return message
  }
}

declare var self: any | undefined
declare var window: any | undefined
declare var global: any | undefined
var globalThis: any = (() => {
  if (typeof globalThis !== 'undefined') return globalThis
  if (typeof self !== 'undefined') return self
  if (typeof window !== 'undefined') return window
  if (typeof global !== 'undefined') return global
  throw 'Unable to locate global object'
})()

const atob: (b64: string) => string =
  globalThis.atob || ((b64) => globalThis.Buffer.from(b64, 'base64').toString('binary'))
function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; ++i) {
    arr[i] = bin.charCodeAt(i)
  }
  return arr
}

const btoa: (bin: string) => string =
  globalThis.btoa || ((bin) => globalThis.Buffer.from(bin, 'binary').toString('base64'))
function base64FromBytes(arr: Uint8Array): string {
  const bin: string[] = []
  arr.forEach((byte) => {
    bin.push(String.fromCharCode(byte))
  })
  return btoa(bin.join(''))
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

function longToNumber(long: Long): number {
  if (long.gt(Number.MAX_SAFE_INTEGER)) {
    throw new globalThis.Error('Value is larger than Number.MAX_SAFE_INTEGER')
  }
  return long.toNumber()
}

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any
  _m0.configure()
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined
}
