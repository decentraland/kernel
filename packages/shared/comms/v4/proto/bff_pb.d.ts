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

  getConnStr(): string;
  setConnStr(value: string): void;

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
    connStr: string,
  }
}

export class OpenMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  getPayload(): string;
  setPayload(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): OpenMessage.AsObject;
  static toObject(includeInstance: boolean, msg: OpenMessage): OpenMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: OpenMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): OpenMessage;
  static deserializeBinaryFromReader(message: OpenMessage, reader: jspb.BinaryReader): OpenMessage;
}

export namespace OpenMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
    payload: string,
  }
}

export class ValidationMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  getEncodedPayload(): string;
  setEncodedPayload(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ValidationMessage.AsObject;
  static toObject(includeInstance: boolean, msg: ValidationMessage): ValidationMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ValidationMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ValidationMessage;
  static deserializeBinaryFromReader(message: ValidationMessage, reader: jspb.BinaryReader): ValidationMessage;
}

export namespace ValidationMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
    encodedPayload: string,
  }
}

export class ValidationResultMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ValidationResultMessage.AsObject;
  static toObject(includeInstance: boolean, msg: ValidationResultMessage): ValidationResultMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ValidationResultMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ValidationResultMessage;
  static deserializeBinaryFromReader(message: ValidationResultMessage, reader: jspb.BinaryReader): ValidationResultMessage;
}

export namespace ValidationResultMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
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

  getPeerId(): string;
  setPeerId(value: string): void;

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
    peerId: string,
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
  OPEN: 5;
  VALIDATION: 6;
  VALIDATION_FAILURE: 7;
  VALIDATION_OK: 8;
}

export const MessageType: MessageTypeMap;

