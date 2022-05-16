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

export class ValidationOKMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  getPeerId(): string;
  setPeerId(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ValidationOKMessage.AsObject;
  static toObject(includeInstance: boolean, msg: ValidationOKMessage): ValidationOKMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ValidationOKMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ValidationOKMessage;
  static deserializeBinaryFromReader(message: ValidationOKMessage, reader: jspb.BinaryReader): ValidationOKMessage;
}

export namespace ValidationOKMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
    peerId: string,
  }
}

export class ValidationFailureMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ValidationFailureMessage.AsObject;
  static toObject(includeInstance: boolean, msg: ValidationFailureMessage): ValidationFailureMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ValidationFailureMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ValidationFailureMessage;
  static deserializeBinaryFromReader(message: ValidationFailureMessage, reader: jspb.BinaryReader): ValidationFailureMessage;
}

export namespace ValidationFailureMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
  }
}

export class SubscriptionMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  clearTopicsList(): void;
  getTopicsList(): Array<string>;
  setTopicsList(value: Array<string>): void;
  addTopics(value: string, index?: number): string;

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
    topicsList: Array<string>,
  }
}

export class TopicMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  hasPeerId(): boolean;
  clearPeerId(): void;
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
  SUBSCRIPTION: 1;
  TOPIC: 2;
  OPEN: 3;
  VALIDATION: 4;
  VALIDATION_FAILURE: 5;
  VALIDATION_OK: 6;
}

export const MessageType: MessageTypeMap;

