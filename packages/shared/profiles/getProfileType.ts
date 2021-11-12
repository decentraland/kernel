import { ExplorerIdentity } from 'shared/session/types'
import { ProfileType } from './types'

export function getProfileType(identity?: ExplorerIdentity): ProfileType {
  console.log(
    `getProfileType of ${identity?.address} is ${
      identity?.hasConnectedWeb3 ? 'ProfileType.DEPLOYED' : 'ProfileType.LOCAL'
    } `
  )
  return identity?.hasConnectedWeb3 ? ProfileType.DEPLOYED : ProfileType.LOCAL
}
