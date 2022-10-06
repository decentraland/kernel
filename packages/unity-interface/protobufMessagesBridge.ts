import {
  PBCreateEntity,
  PBRemoveEntity,
  PBUpdateEntityComponent,
  PBAttachEntityComponent,
  PBComponentRemoved,
  PBSetEntityParent,
  PBQuery,
  PBRayQuery,
  PBComponentCreated,
  PBComponentUpdated,
  PBOpenExternalUrl,
  PBOpenNFTDialog,
  PBSendSceneMessage
} from 'shared/protocol/renderer-protocol/EngineInterface.gen'
import {
  CreateEntityPayload,
  RemoveEntityPayload,
  SetEntityParentPayload,
  ComponentRemovedPayload,
  ComponentCreatedPayload,
  QueryPayload,
  ComponentDisposedPayload,
  ComponentUpdatedPayload,
  OpenNFTDialogPayload,
  UpdateEntityComponentPayload,
  AttachEntityComponentPayload
} from '../shared/types'

// protobuf message instances
const updateEntityComponent: PBUpdateEntityComponent = { classId: 0, data: '', entityId: '', name: '' }

export class ProtobufMessagesBridge {
  encodeSceneMessage(
    parcelSceneId: string,
    sceneNumber: number,
    method: string,
    payload: any,
    tag: string = ''
  ): string {
    const message: PBSendSceneMessage = {
      sceneId: parcelSceneId,
      tag,
      sceneNumber
    } as PBSendSceneMessage

    switch (method) {
      case 'CreateEntity':
        message.createEntity = this.encodeCreateEntity(payload)
        break
      case 'RemoveEntity':
        message.removeEntity = this.encodeRemoveEntity(payload)
        break
      case 'UpdateEntityComponent':
        message.updateEntityComponent = this.encodeUpdateEntityComponent(payload)
        break
      case 'AttachEntityComponent':
        message.attachEntityComponent = this.encodeAttachEntityComponent(payload)
        break
      case 'ComponentRemoved':
        message.componentRemoved = this.encodeComponentRemoved(payload)
        break
      case 'SetEntityParent':
        message.setEntityParent = this.encodeSetEntityParent(payload)
        break
      case 'Query':
        message.query = this.encodeQuery(payload)
        break
      case 'ComponentCreated':
        message.componentCreated = this.encodeComponentCreated(payload)
        break
      case 'ComponentDisposed':
        message.componentDisposed = this.encodeComponentDisposed(payload)
        break
      case 'ComponentUpdated':
        message.componentUpdated = this.encodeComponentUpdated(payload)
        break
      case 'InitMessagesFinished':
        message.sceneStarted = {}
        break
      case 'OpenExternalUrl':
        message.openExternalUrl = this.encodeOpenExternalUrl(payload)
        break
      case 'OpenNFTDialog':
        message.openNFTDialog = this.encodeOpenNFTDialog(payload)
        break
    }

    const arrayBuffer: Uint8Array = PBSendSceneMessage.encode(message).finish()
    return btoa(String.fromCharCode(...arrayBuffer))
  }

  encodeCreateEntity(createEntityPayload: CreateEntityPayload): PBCreateEntity {
    return createEntityPayload
  }

  encodeRemoveEntity(removeEntityPayload: RemoveEntityPayload): PBRemoveEntity {
    return removeEntityPayload
  }

  encodeUpdateEntityComponent(updateEntityComponentPayload: UpdateEntityComponentPayload): PBUpdateEntityComponent {
    updateEntityComponent.classId = updateEntityComponentPayload.classId
    updateEntityComponent.entityId = updateEntityComponentPayload.entityId
    updateEntityComponent.data = updateEntityComponentPayload.json
    return updateEntityComponent
  }

  encodeAttachEntityComponent(attachEntityPayload: AttachEntityComponentPayload): PBAttachEntityComponent {
    return attachEntityPayload
  }

  encodeComponentRemoved(removeEntityComponentPayload: ComponentRemovedPayload): PBComponentRemoved {
    return removeEntityComponentPayload
  }

  encodeSetEntityParent(setEntityParentPayload: SetEntityParentPayload): PBSetEntityParent {
    return setEntityParentPayload
  }

  encodeQuery(queryPayload: QueryPayload): PBQuery {
    const arrayBuffer: Uint8Array = PBRayQuery.encode(queryPayload.payload).finish()
    const base64: string = btoa(String.fromCharCode(...arrayBuffer))

    return {
      payload: base64,
      queryId: queryPayload.queryId
    }
  }

  encodeComponentCreated(componentCreatedPayload: ComponentCreatedPayload): PBComponentCreated {
    return {
      classid: componentCreatedPayload.classId,
      id: componentCreatedPayload.id,
      name: componentCreatedPayload.name
    }
  }

  encodeComponentDisposed(componentDisposedPayload: ComponentDisposedPayload) {
    return componentDisposedPayload
  }

  encodeComponentUpdated(componentUpdatedPayload: ComponentUpdatedPayload): PBComponentUpdated {
    return componentUpdatedPayload
  }

  encodeOpenExternalUrl(url: any): PBOpenExternalUrl {
    return {
      url
    }
  }

  encodeOpenNFTDialog(nftDialogPayload: OpenNFTDialogPayload): PBOpenNFTDialog {
    return {
      assetContractAddress: nftDialogPayload.assetContractAddress,
      tokenId: nftDialogPayload.tokenId,
      comment: nftDialogPayload.comment ? nftDialogPayload.comment : ''
    }
  }
}

export const protobufMsgBridge: ProtobufMessagesBridge = new ProtobufMessagesBridge()
