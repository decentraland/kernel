import { defaultLogger } from 'shared/logger'
import { ErrorContextTypes, ReportFatalErrorWithUnityPayloadAsync } from 'shared/loading/ReportFatalError'
import { getUnityInstance, IUnityInterface } from './IUnityInterface'
import { fetchSceneIds } from 'decentraland-loader/lifecycle/utils/fetchSceneIds'
import { fetchSceneJson } from 'decentraland-loader/lifecycle/utils/fetchSceneJson'
import { SceneJsonData } from 'shared/types'
import { SpawnPoint } from '@dcl/schemas'
import { gridToWorld, parseParcelPosition } from 'atomicHelpers/parcelScenePositions'
import { Vector3 } from '@dcl/ecs-math'

export class ClientDebug {
  private unityInterface: IUnityInterface

  public constructor(unityInterface: IUnityInterface) {
    this.unityInterface = unityInterface
  }

  public DumpScenesLoadInfo() {
    this.unityInterface.SendMessageToUnity('Main', 'DumpScenesLoadInfo')
  }

  public DumpRendererLockersInfo() {
    this.unityInterface.SendMessageToUnity('Main', 'DumpRendererLockersInfo')
  }

  public RunPerformanceMeterTool(durationInSeconds: number) {
    this.unityInterface.SendMessageToUnity('Main', 'RunPerformanceMeterTool', durationInSeconds)
  }

  public TestErrorReport(message: string, context: ErrorContextTypes) {
    ReportFatalErrorWithUnityPayloadAsync(new Error(message), context)
      .then(() => defaultLogger.log(`Report sent success.`))
      .catch(() => defaultLogger.log(`Report sent fail.`))

    defaultLogger.log(`Report being sent.`)
  }

  public DumpCrashPayload() {
    this.unityInterface
      .CrashPayloadRequest()
      .then((payload: string) => {
        defaultLogger.log(`DumpCrashPayload result:\n${payload}`)
        defaultLogger.log(`DumpCrashPayload length:${payload.length}`)
      })
      .catch((_x) => {
        defaultLogger.log(`DumpCrashPayload result: timeout`)
      })
  }

  public InstantiateBotsAtWorldPos(payload: {
    amount: number
    xPos: number
    yPos: number
    zPos: number
    areaWidth: number
    areaDepth: number
  }) {
    this.unityInterface.SendMessageToUnity('Main', 'InstantiateBotsAtWorldPos', JSON.stringify(payload))
  }

  public InstantiateBotsAtCoords(payload: {
    amount: number
    xCoord: number
    yCoord: number
    areaWidth: number
    areaDepth: number
  }) {
    this.unityInterface.SendMessageToUnity('Main', 'InstantiateBotsAtCoords', JSON.stringify(payload))
  }

  public StartBotsRandomizedMovement(payload: {
    populationNormalizedPercentage: number
    waypointsUpdateTime: number
    xCoord: number
    yCoord: number
    areaWidth: number
    areaDepth: number
  }) {
    this.unityInterface.SendMessageToUnity('Main', 'StartBotsRandomizedMovement', JSON.stringify(payload))
  }

  public StopBotsMovement() {
    this.unityInterface.SendMessageToUnity('Main', 'StopBotsMovement')
  }

  public RemoveBot(targetEntityId: string) {
    this.unityInterface.SendMessageToUnity('Main', 'RemoveBot', targetEntityId)
  }

  public ClearBots() {
    this.unityInterface.SendMessageToUnity('Main', 'ClearBots')
  }

  public async ToggleSceneBoundingBoxes(scene: string, enabled: boolean) {
    const isInputCoords = isValueACoordinate(scene)
    const sceneId: string | undefined = isInputCoords ? await getSceneIdFromCoordinates(scene) : scene

    if (sceneId) {
      this.unityInterface.SendMessageToUnity('Main', 'ToggleSceneBoundingBoxes', JSON.stringify({ sceneId, enabled }))
    } else {
      throw new Error(`scene not found ${scene}`)
    }
  }

  public async ToggleSceneSpawnPoints(scene: string, enabled?: boolean, sceneJsonData?: SceneJsonData) {
    const isInputCoords = isValueACoordinate(scene)
    const sceneId: string | undefined = isInputCoords ? await getSceneIdFromCoordinates(scene) : scene

    if (!sceneId) {
      throw new Error(`scene not found ${scene}`)
    }

    let sceneJson = sceneJsonData

    // if `sceneJsonData` is not in the arguments we fetch the json data
    if (!sceneJson) {
      const fetchJson = await fetchSceneJson([sceneId])
      const fetchedJson = fetchJson[0] ?? undefined

      if (!fetchedJson) {
        throw new Error(`scene json not found ${scene}`)
      }
      sceneJson = fetchedJson.sceneJsonData
    }

    // get base parcel world position to always handle positions in world context
    const base = parseParcelPosition(sceneJson.scene.base)
    const basePosition = new Vector3()
    gridToWorld(base.x, base.y, basePosition)

    const spawnPoints: SpawnPoint[] = []

    // if no spawnpoint set in scene json, we create the default one (0,0,0)
    if (!sceneJson.spawnPoints) {
      spawnPoints.push({
        name: 'undefined',
        position: { x: [basePosition.x], y: [basePosition.y], z: [basePosition.z] },
        default: true
      })
    } else {
      const convertPositionComponent = (value: number | number[], sceneWorldPosition: number): number[] => {
        if (Array.isArray(value)) {
          return value.map((v) => sceneWorldPosition + v)
        }
        return [sceneWorldPosition + value]
      }

      // convert vector3 to world position and always use type `number[]` for spawnpoint position
      for (const spawnPoint of sceneJson.spawnPoints) {
        spawnPoints.push({
          ...spawnPoint,
          position: {
            x: convertPositionComponent(spawnPoint.position.x, basePosition.x),
            y: convertPositionComponent(spawnPoint.position.y, basePosition.y),
            z: convertPositionComponent(spawnPoint.position.z, basePosition.z)
          },
          cameraTarget: spawnPoint.cameraTarget ? basePosition.add(spawnPoint.cameraTarget) : undefined
        })
      }
    }

    this.unityInterface.SendMessageToUnity(
      'Main',
      'ToggleSceneSpawnPoints',
      JSON.stringify({ sceneId, enabled, spawnPoints })
    )
  }
}

function isValueACoordinate(value: string): boolean {
  return value.match(/^-?[0-9]*([,]-?[0-9]*){1}$/) ? true : false
}

async function getSceneIdFromCoordinates(coordinates: string): Promise<string | undefined> {
  const ids = await fetchSceneIds([coordinates])
  return ids[0] ?? undefined
}

export const clientDebug: ClientDebug = new ClientDebug(getUnityInstance())
