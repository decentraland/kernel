import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { SceneStateStorageControllerServiceDefinition } from '../gen/SceneStateStorageController'
import * as SSSCTypes from '../SceneStateStorageController/types'
import { fromProtoSerializedSceneState, toProtoSerializedSceneState } from '../SceneStateStorageController/utils'

export async function createSceneStateStorageControllerServiceClient<Context>(clientPort: RpcClientPort) {
  const originalService = await codegen.loadService<Context, SceneStateStorageControllerServiceDefinition>(
    clientPort,
    SceneStateStorageControllerServiceDefinition
  )

  return {
    ...originalService,
    async sendAssetsToRenderer(state: SSSCTypes.SerializedSceneState): Promise<string> {
      return (
        await originalService.sendAssetsToRenderer({
          state: toProtoSerializedSceneState(state)
        })
      ).state
    },
    async createProjectFromStateDefinition(): Promise<SSSCTypes.SerializedSceneState | undefined> {
      const response = await originalService.createProjectFromStateDefinition({})
      if (response.res) {
        return fromProtoSerializedSceneState(response.res)
      }
      return undefined
    },
    async getStoredState(sceneId: string): Promise<SSSCTypes.SerializedSceneState | undefined> {
      const response = await originalService.getStoredState({ sceneId })
      if (response.res) {
        return fromProtoSerializedSceneState(response.res)
      }
      return undefined
    },
    async getProjectManifest(projectId: string): Promise<SSSCTypes.SerializedSceneState | undefined> {
      const response = await originalService.getProjectManifest({ projectId })
      if (response.state) {
        return fromProtoSerializedSceneState(response.state)
      }
      return undefined
    },
    async getProjectManifestByCoordinates(land: string): Promise<SSSCTypes.SerializedSceneState | undefined> {
      const response = await originalService.getProjectManifestByCoordinates({ land })
      if (response.state) {
        return fromProtoSerializedSceneState(response.state)
      }
      return undefined
    },
    async createProjectWithCoords(coordinates: string): Promise<boolean> {
      return (await originalService.createProjectWithCoords({ coordinates })).ok
    },
    async saveSceneState(serializedSceneState: SSSCTypes.SerializedSceneState): Promise<SSSCTypes.DeploymentResult> {
      const response = await originalService.saveSceneState({
        serializedSceneState: toProtoSerializedSceneState(serializedSceneState)
      })
      if (response.result.ok) {
        return { ok: true }
      } else {
        return { ok: false, error: response.result.error! }
      }
    },
    async saveProjectInfo(
      sceneState: SSSCTypes.SerializedSceneState,
      projectName: string,
      projectDescription: string,
      projectScreenshot: string
    ): Promise<boolean> {
      return (
        await originalService.saveProjectInfo({
          sceneState: toProtoSerializedSceneState(sceneState),
          projectName,
          projectDescription,
          projectScreenshot
        })
      ).ok
    },

    async publishSceneState(
      sceneId: string,
      sceneName: string,
      sceneDescription: string,
      sceneScreenshot: string,
      sceneState: SSSCTypes.SerializedSceneState
    ): Promise<SSSCTypes.DeploymentResult> {
      const response = await originalService.publishSceneState({
        sceneId,
        sceneDescription,
        sceneName,
        sceneScreenshot,
        sceneState: toProtoSerializedSceneState(sceneState)
      })
      if (response.result.ok) {
        return { ok: true }
      } else {
        return { ok: false, error: response.result.error! }
      }
    }
  }
}
