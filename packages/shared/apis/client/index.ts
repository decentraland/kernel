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
import { createExperimentalAPIServiceClient } from './ExperimentalAPI'
import { createWeb3Provider } from './Web3Provider'

export const LoadableAPIs = {
  CommunicationsController: createCommunicationsControllerServiceClient,
  DevTools: createDevToolsServiceClient,
  EngineAPI: createEngineAPIServiceClient,
  EnvironmentAPI: createEnvironmentAPIServiceClient,
  EthereumController: createEthereumControllerServiceClient,
  ExperimentalAPI: createExperimentalAPIServiceClient,
  ParcelIdentity: createParcelIdentityServiceClient,
  Permissions: createPermissionsServiceClient,
  Players: createPlayersServiceClient,
  PortableExpierences: createPortableExperiencesServiceClient,

  // TODO: validate which of the following is actually used.
  RestrictedActions: createRestrictedActionsServiceClient,
  RestrictedActionModule: createRestrictedActionsServiceClient,

  SignedFetch: createSignedFetchServiceClient,
  SocialController: createSocialControllerServiceClient,
  UserActionModule: createUserActionModuleServiceClient,
  // This is UserIdentity in the host-side
  Identity: createUserIdentityServiceClient,

  // This is required by the scenes
  ['web3-provider']: createWeb3Provider
}

export type ILoadedModules<T> = {
  [K in keyof T]?: T[K] extends (...args: any[]) => any ? Awaited<ReturnType<T[K]>> : never
}

export type LoadedModules = ILoadedModules<typeof LoadableAPIs>
