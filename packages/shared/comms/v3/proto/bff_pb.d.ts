// package: protocol
// file: bff.proto

import * as jspb from "google-protobuf";

export class MessageHeader extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): MessageHeader.AsObject;
  static toObject(includeInstance: boolean, msg: MessageHeader): MessageHeader.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: MessageHeader, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): MessageHeader;
  static deserializeBinaryFromReader(message: MessageHeader, reader: jspb.BinaryReader): MessageHeader;
}

export namespace MessageHeader {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
  }
}

export class HeartBeatMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  getTime(): number;
  setTime(value: number): void;

  getData(): Uint8Array | string;
  getData_asU8(): Uint8Array;
  getData_asB64(): string;
  setData(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): HeartBeatMessage.AsObject;
  static toObject(includeInstance: boolean, msg: HeartBeatMessage): HeartBeatMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: HeartBeatMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): HeartBeatMessage;
  static deserializeBinaryFromReader(message: HeartBeatMessage, reader: jspb.BinaryReader): HeartBeatMessage;
}

export namespace HeartBeatMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
    time: number,
    data: Uint8Array | string,
  }
}

export class IslandChangesMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  getTransport(): string;
  setTransport(value: string): void;

  getTopic(): string;
  setTopic(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): IslandChangesMessage.AsObject;
  static toObject(includeInstance: boolean, msg: IslandChangesMessage): IslandChangesMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: IslandChangesMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): IslandChangesMessage;
  static deserializeBinaryFromReader(message: IslandChangesMessage, reader: jspb.BinaryReader): IslandChangesMessage;
}

export namespace IslandChangesMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
    transport: string,
    topic: string,
  }
}

export class SubscriptionMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  getTopics(): Uint8Array | string;
  getTopics_asU8(): Uint8Array;
  getTopics_asB64(): string;
  setTopics(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SubscriptionMessage.AsObject;
  static toObject(includeInstance: boolean, msg: SubscriptionMessage): SubscriptionMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SubscriptionMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SubscriptionMessage;
  static deserializeBinaryFromReader(message: SubscriptionMessage, reader: jspb.BinaryReader): SubscriptionMessage;
}

export namespace SubscriptionMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
    topics: Uint8Array | string,
  }
}

export class TopicMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  getFromAlias(): number;
  setFromAlias(value: number): void;

  getTopic(): string;
  setTopic(value: string): void;

  getBody(): Uint8Array | string;
  getBody_asU8(): Uint8Array;
  getBody_asB64(): string;
  setBody(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): TopicMessage.AsObject;
  static toObject(includeInstance: boolean, msg: TopicMessage): TopicMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: TopicMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): TopicMessage;
  static deserializeBinaryFromReader(message: TopicMessage, reader: jspb.BinaryReader): TopicMessage;
}

export namespace TopicMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
    fromAlias: number,
    topic: string,
    body: Uint8Array | string,
  }
}

export interface MessageTypeMap {
  UNKNOWN_MESSAGE_TYPE: 0;
  HEARTBEAT: 1;
  SUBSCRIPTION: 2;
  TOPIC: 3;
  ISLAND_CHANGES: 4;
}

export const MessageType: MessageTypeMap;

