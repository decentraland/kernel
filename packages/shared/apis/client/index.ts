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
import { createSocialControllerServiceClient } from './SocialController'
import { createCommunicationsControllerServiceClient } from './CommunicationsController'
import { createSignedFetchServiceClient } from './SignedFetch'
import { createRestrictedActionsServiceClient } from './RestrictedActions'
import { createParcelIdentityServiceClient } from './ParcelIdentity'
import { createPlayersServiceClient } from './Players'
import { createPortableExperiencesServiceClient } from './PortableExperiences'

export const LoadableAPIs = {
  CommunicationsController: createCommunicationsControllerServiceClient,
  DevTools: createDevToolsServiceClient,
  EngineAPI: createEngineAPIServiceClient,
  EnvironmentAPI: createEnvironmentAPIServiceClient,
  EthereumController: createEthereumControllerServiceClient,
  ParcelIdentity: createParcelIdentityServiceClient,
  Permissions: createPermissionsServiceClient,
  Players: createPlayersServiceClient,
  PortableExpierences: createPortableExperiencesServiceClient,
  RestrictedActions: createRestrictedActionsServiceClient,
  SignedFetch: createSignedFetchServiceClient,
  SocialController: createSocialControllerServiceClient,
  UserActionModule: createUserActionModuleServiceClient,
  // This is UserIdentity in the host-side
  Identity: createUserIdentityServiceClient
}

export type ILoadedModules<T> = {
  [K in keyof T]?: T[K] extends (...args: any[]) => any ? Awaited<ReturnType<T[K]>> : never
}

export type LoadedModules = ILoadedModules<typeof LoadableAPIs>
