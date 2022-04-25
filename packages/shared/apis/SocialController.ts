import { APIOptions, registerAPI } from 'decentraland-rpc/lib/host'
import { ExposableAPI } from './ExposableAPI'
import { EngineAPI } from 'shared/apis/EngineAPI'
import { avatarMessageObservable } from 'shared/comms/peers'

export interface IProfileData {
  displayName: string
  publicKey: string
  status: string
  avatarType: string
  isMuted: boolean
  isBlocked: boolean
}

@registerAPI('SocialController')
export class SocialController extends ExposableAPI {
  static pluginName = 'SocialController'

  constructor(options: APIOptions) {
    super(options)

    const engineAPI = options.getAPIInstance(EngineAPI)

    avatarMessageObservable.add((event: any) => {
      engineAPI.sendSubscriptionEvent('AVATAR_OBSERVABLE' as any, event)
    })
  }
}
