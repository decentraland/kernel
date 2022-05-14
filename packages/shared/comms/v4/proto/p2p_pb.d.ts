// package: 
// file: p2p.proto

import * as jspb from "google-protobuf";

export class MessageData extends jspb.Message {
  getRoom(): string;
  setRoom(value: string): void;

  clearDstList(): void;
  getDstList(): Array<Uint8Array | string>;
  getDstList_asU8(): Array<Uint8Array>;
  getDstList_asB64(): Array<string>;
  setDstList(value: Array<Uint8Array | string>): void;
  addDst(value: Uint8Array | string, index?: number): Uint8Array | string;

  getPayload(): Uint8Array | string;
  getPayload_asU8(): Uint8Array;
  getPayload_asB64(): string;
  setPayload(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MessageData.AsObject;
  static toObject(includeInstance: boolean, msg: MessageData): MessageData.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: MessageData, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MessageData;
  static deserializeBinaryFromReader(message: MessageData, reader: jspb.BinaryReader): MessageData;
}

export namespace MessageData {
  export type AsObject = {
    room: string,
    dstList: Array<Uint8Array | string>,
    payload: Uint8Array | string,
  }
}

export class PingData extends jspb.Message {
  getPingId(): number;
  setPingId(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PingData.AsObject;
  static toObject(includeInstance: boolean, msg: PingData): PingData.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: PingData, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PingData;
  static deserializeBinaryFromReader(message: PingData, reader: jspb.BinaryReader): PingData;
}

export namespace PingData {
  export type AsObject = {
    pingId: number,
  }
}

export class PongData extends jspb.Message {
  getPingId(): number;
  setPingId(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): PongData.AsObject;
  static toObject(includeInstance: boolean, msg: PongData): PongData.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: PongData, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): PongData;
  static deserializeBinaryFromReader(message: PongData, reader: jspb.BinaryReader): PongData;
}

export namespace PongData {
  export type AsObject = {
    pingId: number,
  }
}

export class SuspendRelayData extends jspb.Message {
  clearRelayedPeersList(): void;
  getRelayedPeersList(): Array<string>;
  setRelayedPeersList(value: Array<string>): void;
  addRelayedPeers(value: string, index?: number): string;

  getDurationMillis(): number;
  setDurationMillis(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SuspendRelayData.AsObject;
  static toObject(includeInstance: boolean, msg: SuspendRelayData): SuspendRelayData.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SuspendRelayData, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SuspendRelayData;
  static deserializeBinaryFromReader(message: SuspendRelayData, reader: jspb.BinaryReader): SuspendRelayData;
}

export namespace SuspendRelayData {
  export type AsObject = {
    relayedPeersList: Array<string>,
    durationMillis: number,
  }
}

export class Packet extends jspb.Message {
  getSequenceId(): number;
  setSequenceId(value: number): void;

  getInstanceId(): number;
  setInstanceId(value: number): void;

  getTimestamp(): number;
  setTimestamp(value: number): void;

  getSrc(): string;
  setSrc(value: string): void;

  getSubtype(): string;
  setSubtype(value: string): void;

  getDiscardOlderThan(): number;
  setDiscardOlderThan(value: number): void;

  getOptimistic(): boolean;
  setOptimistic(value: boolean): void;

  getExpireTime(): number;
  setExpireTime(value: number): void;

  getHops(): number;
  setHops(value: number): void;

  getTtl(): number;
  setTtl(value: number): void;

  clearReceivedByList(): void;
  getReceivedByList(): Array<string>;
  setReceivedByList(value: Array<string>): void;
  addReceivedBy(value: string, index?: number): string;

  hasMessageData(): boolean;
  clearMessageData(): void;
  getMessageData(): MessageData | undefined;
  setMessageData(value?: MessageData): void;

  hasPingData(): boolean;
  clearPingData(): void;
  getPingData(): PingData | undefined;
  setPingData(value?: PingData): void;

  hasPongData(): boolean;
  clearPongData(): void;
  getPongData(): PongData | undefined;
  setPongData(value?: PongData): void;

  hasSuspendRelayData(): boolean;
  clearSuspendRelayData(): void;
  getSuspendRelayData(): SuspendRelayData | undefined;
  setSuspendRelayData(value?: SuspendRelayData): void;

  getDataCase(): Packet.DataCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Packet.AsObject;
  static toObject(includeInstance: boolean, msg: Packet): Packet.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Packet, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Packet;
  static deserializeBinaryFromReader(message: Packet, reader: jspb.BinaryReader): Packet;
}

export namespace Packet {
  export type AsObject = {
    sequenceId: number,
    instanceId: number,
    timestamp: number,
    src: string,
    subtype: string,
    discardOlderThan: number,
    optimistic: boolean,
    expireTime: number,
    hops: number,
    ttl: number,
    receivedByList: Array<string>,
    messageData?: MessageData.AsObject,
    pingData?: PingData.AsObject,
    pongData?: PongData.AsObject,
    suspendRelayData?: SuspendRelayData.AsObject,
  }

  export enum DataCase {
    DATA_NOT_SET = 0,
    MESSAGE_DATA = 11,
    PING_DATA = 12,
    PONG_DATA = 13,
    SUSPEND_RELAY_DATA = 15,
  }
}

export interface PacketTypeMap {
  UKNOWN_PACKET_TYPE: 0;
  MESSAGE: 1;
  PING: 2;
  PONG: 3;
  SUSPEND_RELAY: 4;
}

export const PacketType: PacketTypeMap;

