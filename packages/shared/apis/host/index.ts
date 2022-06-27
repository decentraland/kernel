import { RpcServerPort } from '@dcl/rpc/dist/types'
import { PortContext } from './context'

import { registerEthereumControllerServiceServerImplementation } from './EthereumController'
import { registerDevToolsServiceServerImplementation } from './DevTools'
import { registerEngineAPIServiceServerImplementation } from './EngineAPI'
import { registerEnvironmentAPIServiceServerImplementation } from './EnvironmentAPI'
import { registerExperimentalAPIServiceServerImplementation } from './ExperimentalAPI'
import { registerPermissionServiceServerImplementation } from './Permissions'
import { registerUserIdentityServiceServerImplementation } from './UserIdentity'
import { registerParcelIdentityServiceServerImplementation } from './ParcelIdentity'
import { registerUserActionModuleServiceServerImplementation } from './UserActionModule'
import { registerSocialControllerServiceServerImplementation } from './SocialController'
import { registerRestrictedActionsServiceServerImplementation } from './RestrictedActions'
import { registerCommunicationsControllerServiceServerImplementation } from './CommunicationsController'
import { registerPlayersServiceServerImplementation } from './Players'
import { registerPortableExperiencesServiceServerImplementation } from './PortableExperiences'
import { registerSignedFetchServiceServerImplementation } from './SignedFetch'

export async function registerServices(serverPort: RpcServerPort<PortContext>) {
  registerDevToolsServiceServerImplementation(serverPort)
  registerEngineAPIServiceServerImplementation(serverPort)
  registerEnvironmentAPIServiceServerImplementation(serverPort)
  registerPermissionServiceServerImplementation(serverPort)
  registerUserIdentityServiceServerImplementation(serverPort)
  registerUserActionModuleServiceServerImplementation(serverPort)
  registerEthereumControllerServiceServerImplementation(serverPort)
  registerParcelIdentityServiceServerImplementation(serverPort)
  registerSocialControllerServiceServerImplementation(serverPort)
  registerRestrictedActionsServiceServerImplementation(serverPort)
  registerCommunicationsControllerServiceServerImplementation(serverPort)
  registerPlayersServiceServerImplementation(serverPort)
  registerPortableExperiencesServiceServerImplementation(serverPort)
  registerSignedFetchServiceServerImplementation(serverPort)

  // TODO: remove when renderer-rpc is ready
  registerExperimentalAPIServiceServerImplementation(serverPort)
}
