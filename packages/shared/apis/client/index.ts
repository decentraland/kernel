// import './EngineAPI'
// import './UserIdentity'
// import './ParcelIdentity'
// import './EnvironmentAPI'
// import './EthereumController'
// import './SocialController'
// import './DevTools'
// import './CommunicationsController'
// import './UserActionModule'
// import './PortableExperiences'
// import './RestrictedActions'
// import './SignedFetch'
// import './SceneStateStorageController/SceneStateStorageController'
// import './Players'
// import './Permissions'

import { createEngineAPIServiceClient } from './EngineAPI'
import { createUserActionModuleServiceClient } from './UserActionModule'
import { createUserIdentityServiceClient } from './UserIdentity'
import { createEnvironmentAPIServiceClient } from './EnvironmentAPI'
import { createDevToolsServiceClient } from './DevTools'
import { createPermissionsServiceClient } from './Permissions'
import { createEthereumControllerServiceClient } from './EthereumController'

export const LoadableAPIs = {
  EngineAPI: createEngineAPIServiceClient,
  UserActionModule: createUserActionModuleServiceClient,
  UserIdentity: createUserIdentityServiceClient,
  EnvironmentAPI: createEnvironmentAPIServiceClient,
  DevTools: createDevToolsServiceClient,
  Permissions: createPermissionsServiceClient,
  EthereumController: createEthereumControllerServiceClient
}

export type ILoadedModules<T> = {
  [K in keyof T]?: T[K] extends (...args: any[]) => any ? Awaited<ReturnType<T[K]>> : never
}

export type LoadedModules = ILoadedModules<typeof LoadableAPIs>
