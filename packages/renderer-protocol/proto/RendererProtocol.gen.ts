/* eslint-disable */
import Long from 'long'
import * as _m0 from 'protobufjs/minimal'

export const protobufPackage = ''

export interface CRDTManyMessages {
  sceneId: string
  payload: Uint8Array
}

export interface CRDTResponse {}

export interface CRDTStreamRequest {}

export interface PingRequest {}

export interface PongResponse {}

function createBaseCRDTManyMessages(): CRDTManyMessages {
  return { sceneId: '', payload: new Uint8Array() }
}

export const CRDTManyMessages = {
  encode(message: CRDTManyMessages, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.sceneId !== '') {
      writer.uint32(10).string(message.sceneId)
    }
    if (message.payload.length !== 0) {
      writer.uint32(18).bytes(message.payload)
    }
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CRDTManyMessages {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseCRDTManyMessages()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        case 1:
          message.sceneId = reader.string()
          break
        case 2:
          message.payload = reader.bytes()
          break
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(object: any): CRDTManyMessages {
    return {
      sceneId: isSet(object.sceneId) ? String(object.sceneId) : '',
      payload: isSet(object.payload) ? bytesFromBase64(object.payload) : new Uint8Array()
    }
  },

  toJSON(message: CRDTManyMessages): unknown {
    const obj: any = {}
    message.sceneId !== undefined && (obj.sceneId = message.sceneId)
    message.payload !== undefined &&
      (obj.payload = base64FromBytes(message.payload !== undefined ? message.payload : new Uint8Array()))
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<CRDTManyMessages>, I>>(object: I): CRDTManyMessages {
    const message = createBaseCRDTManyMessages()
    message.sceneId = object.sceneId ?? ''
    message.payload = object.payload ?? new Uint8Array()
    return message
  }
}

function createBaseCRDTResponse(): CRDTResponse {
  return {}
}

export const CRDTResponse = {
  encode(_: CRDTResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CRDTResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseCRDTResponse()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(_: any): CRDTResponse {
    return {}
  },

  toJSON(_: CRDTResponse): unknown {
    const obj: any = {}
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<CRDTResponse>, I>>(_: I): CRDTResponse {
    const message = createBaseCRDTResponse()
    return message
  }
}

function createBaseCRDTStreamRequest(): CRDTStreamRequest {
  return {}
}

export const CRDTStreamRequest = {
  encode(_: CRDTStreamRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CRDTStreamRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBaseCRDTStreamRequest()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(_: any): CRDTStreamRequest {
    return {}
  },

  toJSON(_: CRDTStreamRequest): unknown {
    const obj: any = {}
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<CRDTStreamRequest>, I>>(_: I): CRDTStreamRequest {
    const message = createBaseCRDTStreamRequest()
    return message
  }
}

function createBasePingRequest(): PingRequest {
  return {}
}

export const PingRequest = {
  encode(_: PingRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PingRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBasePingRequest()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(_: any): PingRequest {
    return {}
  },

  toJSON(_: PingRequest): unknown {
    const obj: any = {}
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<PingRequest>, I>>(_: I): PingRequest {
    const message = createBasePingRequest()
    return message
  }
}

function createBasePongResponse(): PongResponse {
  return {}
}

export const PongResponse = {
  encode(_: PongResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PongResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input)
    let end = length === undefined ? reader.len : reader.pos + length
    const message = createBasePongResponse()
    while (reader.pos < end) {
      const tag = reader.uint32()
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7)
          break
      }
    }
    return message
  },

  fromJSON(_: any): PongResponse {
    return {}
  },

  toJSON(_: PongResponse): unknown {
    const obj: any = {}
    return obj
  },

  fromPartial<I extends Exact<DeepPartial<PongResponse>, I>>(_: I): PongResponse {
    const message = createBasePongResponse()
    return message
  }
}

export type CRDTServiceDefinition = typeof CRDTServiceDefinition
export const CRDTServiceDefinition = {
  name: 'CRDTService',
  fullName: 'CRDTService',
  methods: {
    sendCRDT: {
      name: 'SendCRDT',
      requestType: CRDTManyMessages,
      requestStream: false,
      responseType: CRDTResponse,
      responseStream: false,
      options: {}
    },
    cRDTNotificationStream: {
      name: 'CRDTNotificationStream',
      requestType: CRDTStreamRequest,
      requestStream: false,
      responseType: CRDTManyMessages,
      responseStream: true,
      options: {}
    }
  }
} as const

export type PingPongServiceDefinition = typeof PingPongServiceDefinition
export const PingPongServiceDefinition = {
  name: 'PingPongService',
  fullName: 'PingPongService',
  methods: {
    ping: {
      name: 'Ping',
      requestType: PingRequest,
      requestStream: false,
      responseType: PongResponse,
      responseStream: false,
      options: {}
    }
  }
} as const

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

function isSet(value: any): boolean {
  return value !== null && value !== undefined
}
