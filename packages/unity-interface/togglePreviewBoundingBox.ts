import { getPreviewSceneId } from '../unity-interface/dcl'
import { clientDebug } from './ClientDebug'

let on = false

export async function togglePreviewBoundingBox() {
  try {
    const previewScene = await getPreviewSceneId()

    if (!previewScene.sceneId) {
      throw new Error(`id for preview scene not found`)
    }

    await clientDebug.ToggleSceneBoundingBoxes(previewScene.sceneId, !on)
    on = !on
  } catch (e) {
    throw e
  }
}
