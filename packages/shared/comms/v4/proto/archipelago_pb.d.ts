// package: protocol
// file: archipelago.proto

import * as jspb from "google-protobuf";

export class Position3DMessage extends jspb.Message {
  getX(): number;
  setX(value: number): void;

  getY(): number;
  setY(value: number): void;

  getZ(): number;
  setZ(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Position3DMessage.AsObject;
  static toObject(includeInstance: boolean, msg: Position3DMessage): Position3DMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Position3DMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Position3DMessage;
  static deserializeBinaryFromReader(message: Position3DMessage, reader: jspb.BinaryReader): Position3DMessage;
}

export namespace Position3DMessage {
  export type AsObject = {
    x: number,
    y: number,
    z: number,
  }
}

export class HeartbeatMessage extends jspb.Message {
  hasPosition(): boolean;
  clearPosition(): void;
  getPosition(): Position3DMessage | undefined;
  setPosition(value?: Position3DMessage): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): HeartbeatMessage.AsObject;
  static toObject(includeInstance: boolean, msg: HeartbeatMessage): HeartbeatMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: HeartbeatMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): HeartbeatMessage;
  static deserializeBinaryFromReader(message: HeartbeatMessage, reader: jspb.BinaryReader): HeartbeatMessage;
}

export namespace HeartbeatMessage {
  export type AsObject = {
    position?: Position3DMessage.AsObject,
  }
}

export class IslandChangedMessage extends jspb.Message {
  getIslandId(): string;
  setIslandId(value: string): void;

  getConnStr(): string;
  setConnStr(value: string): void;

  hasFromIslandId(): boolean;
  clearFromIslandId(): void;
  getFromIslandId(): string;
  setFromIslandId(value: string): void;

  getPeersMap(): jspb.Map<string, Position3DMessage>;
  clearPeersMap(): void;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): IslandChangedMessage.AsObject;
  static toObject(includeInstance: boolean, msg: IslandChangedMessage): IslandChangedMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: IslandChangedMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): IslandChangedMessage;
  static deserializeBinaryFromReader(message: IslandChangedMessage, reader: jspb.BinaryReader): IslandChangedMessage;
}

export namespace IslandChangedMessage {
  export type AsObject = {
    islandId: string,
    connStr: string,
    fromIslandId: string,
    peersMap: Array<[string, Position3DMessage.AsObject]>,
  }
}

export class LeftIslandMessage extends jspb.Message {
  getIslandId(): string;
  setIslandId(value: string): void;

  getPeerId(): string;
  setPeerId(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): LeftIslandMessage.AsObject;
  static toObject(includeInstance: boolean, msg: LeftIslandMessage): LeftIslandMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: LeftIslandMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): LeftIslandMessage;
  static deserializeBinaryFromReader(message: LeftIslandMessage, reader: jspb.BinaryReader): LeftIslandMessage;
}

export namespace LeftIslandMessage {
  export type AsObject = {
    islandId: string,
    peerId: string,
  }
}

export class JoinIslandMessage extends jspb.Message {
  getIslandId(): string;
  setIslandId(value: string): void;

  getPeerId(): string;
  setPeerId(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): JoinIslandMessage.AsObject;
  static toObject(includeInstance: boolean, msg: JoinIslandMessage): JoinIslandMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: JoinIslandMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): JoinIslandMessage;
  static deserializeBinaryFromReader(message: JoinIslandMessage, reader: jspb.BinaryReader): JoinIslandMessage;
}

export namespace JoinIslandMessage {
  export type AsObject = {
    islandId: string,
    peerId: string,
  }
}

