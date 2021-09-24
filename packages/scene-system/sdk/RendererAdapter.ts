import { DecentralandInterface } from 'decentraland-ecs'

export type RendererAdapterOptions = {
  entities: Set<number>[]
  components: any[]

  dcl: DecentralandInterface
}

// see https://github.com/decentraland/unity-renderer/blob/master/unity-renderer/Assets/Scripts/MainScripts/DCL/Models/Protocol/Protocol.cs#L5-L69
// CLASS_ID_COMPONENT are updateEntityComponent and
// CLASS_ID component are only componentUpdate
const CLASS_ID_COMPONENT = [1]

export const rendererAdapter = ({ entities, components, dcl }: RendererAdapterOptions) => {
  const putComponent = ({
    entityId,
    componentNumber,
    componentData,
    timestamp
  }: {
    entityId: number
    componentNumber: number
    componentData: any
    timestamp: number
  }) => {
    if (entities[entityId] === undefined) {
      entities[entityId] = new Set()
      dcl.addEntity(entityId.toString())
    }
    ;(entities[entityId] as Set<number>).add(componentNumber)

    const classId = componentData['classId']

    if (components[componentNumber]) {
      if (components[componentNumber].timestamp >= timestamp) {
        return
      }

      if (CLASS_ID_COMPONENT.includes(classId)) {
        dcl.updateEntityComponent(
          entityId.toString(),
          `engine.${componentNumber.toString()}`,
          componentData['classId'],
          JSON.stringify(componentData['data'])
        )
      } else {
        //debugger
        dcl.componentUpdated(`engine.${componentNumber.toString()}`, JSON.stringify(componentData['data']))
      }
    } else {
      //debugger
      if (!CLASS_ID_COMPONENT.includes(classId)) {
        //debugger

        dcl.componentCreated(
          componentNumber.toString(),
          `engine.${componentNumber.toString()}`,
          componentData['classId']
        )
        dcl.attachEntityComponent(
          entityId.toString(),
          `engine.${componentNumber.toString()}`,
          componentNumber.toString()
        )
      }
    }

    components[componentNumber] = {
      data: componentData,
      timestamp
    }
  }

  return {
    bufferReader: (rendererBuffer: Buffer) => {
      const messageType = rendererBuffer.readInt32LE(0)
      const entityId = rendererBuffer.readInt32LE(4) // BIGINT INSTEAD
      const componentNumber = rendererBuffer.readInt32LE(12) // BIGINT INSTEAD
      const timestamp = rendererBuffer.readInt32LE(20) // BIGINT INSTEAD
      const dataLength = rendererBuffer.readInt32LE(28)
      let componentData: any | null = null
      if (dataLength > 0) {
        if (rendererBuffer.length - 32 !== dataLength) {
          console.error('corrupt message')
          return
        }

        try {
          const componentDataStr = Buffer.from(rendererBuffer.subarray(32, 32 + dataLength)).toString('utf-8')
          componentData = JSON.parse(componentDataStr)
        } catch (err) {
          console.error(err)
        }
      }

      // remove component
      if (componentData == null) {
        if (messageType == 2) {
        } else {
          // ??? put component with no data
        }
      } else {
        if (messageType == 1) {
          // frequently use case: put component and udpate
          setTimeout(() => {
            putComponent({ entityId, componentNumber, componentData, timestamp })
          }, 1)
        } else {
          // ??? remove component with data
        }
      }
    }
  }
}
