// package: protocol
// file: ws.proto

import * as jspb from "google-protobuf";

export class WelcomeMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  getAlias(): number;
  setAlias(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): WelcomeMessage.AsObject;
  static toObject(includeInstance: boolean, msg: WelcomeMessage): WelcomeMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: WelcomeMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): WelcomeMessage;
  static deserializeBinaryFromReader(message: WelcomeMessage, reader: jspb.BinaryReader): WelcomeMessage;
}

export namespace WelcomeMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
    alias: number,
  }
}

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

export class SystemMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  getFromAlias(): number;
  setFromAlias(value: number): void;

  getBody(): Uint8Array | string;
  getBody_asU8(): Uint8Array;
  getBody_asB64(): string;
  setBody(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SystemMessage.AsObject;
  static toObject(includeInstance: boolean, msg: SystemMessage): SystemMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SystemMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SystemMessage;
  static deserializeBinaryFromReader(message: SystemMessage, reader: jspb.BinaryReader): SystemMessage;
}

export namespace SystemMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
    fromAlias: number,
    body: Uint8Array | string,
  }
}

export class IdentityMessage extends jspb.Message {
  getType(): MessageTypeMap[keyof MessageTypeMap];
  setType(value: MessageTypeMap[keyof MessageTypeMap]): void;

  getFromAlias(): number;
  setFromAlias(value: number): void;

  getIdentity(): Uint8Array | string;
  getIdentity_asU8(): Uint8Array;
  getIdentity_asB64(): string;
  setIdentity(value: Uint8Array | string): void;

  getBody(): Uint8Array | string;
  getBody_asU8(): Uint8Array;
  getBody_asB64(): string;
  setBody(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): IdentityMessage.AsObject;
  static toObject(includeInstance: boolean, msg: IdentityMessage): IdentityMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: IdentityMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): IdentityMessage;
  static deserializeBinaryFromReader(message: IdentityMessage, reader: jspb.BinaryReader): IdentityMessage;
}

export namespace IdentityMessage {
  export type AsObject = {
    type: MessageTypeMap[keyof MessageTypeMap],
    fromAlias: number,
    identity: Uint8Array | string,
    body: Uint8Array | string,
  }
}

export interface MessageTypeMap {
  UNKNOWN_MESSAGE_TYPE: 0;
  WELCOME: 1;
  SYSTEM: 2;
  IDENTITY: 3;
}

export const MessageType: MessageTypeMap;

