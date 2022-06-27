import { ILogger } from 'shared/logger'
import { EntityAction, LoadableScene } from 'shared/types'

export type IKernelScene = {
  loadableScene: LoadableScene
  logger: ILogger
  sendBatch(actions: EntityAction[]): void
  registerWorker(event: any): void
}
