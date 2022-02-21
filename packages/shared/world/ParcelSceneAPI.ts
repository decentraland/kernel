import { EntityAction, EnvironmentData } from 'shared/types'

export type ParcelSceneAPI = {
  data: EnvironmentData<any>
  sendBatch(actions: EntityAction[]): void
  registerWorker(event: any): void
  on(event: string, cb: (event: any) => void): void
  emit(event: string, data: any): void
  getSceneId(): string
}
