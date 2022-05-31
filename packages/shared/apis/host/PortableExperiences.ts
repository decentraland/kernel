// import { registerAPI, exposeMethod } from 'decentraland-rpc/lib/host'
// import {
//   spawnScenePortableExperienceSceneFromUrn,
//   PortableExperienceHandle,
//   getPortableExperiencesLoaded,
//   getRunningPortableExperience
// } from '../../unity-interface/portableExperiencesUtils'
// import { ExposableAPI } from './ExposableAPI'
// import { ParcelIdentity } from './ParcelIdentity'
// import { store } from '../../shared/store/isolatedStore'
// import { removeScenePortableExperience } from '../../shared/portableExperiences/actions'

// type PortableExperienceUrn = string

// type LoadedPortableExperiences = {
//   pid: string
//   parentCid: string
// }

// @registerAPI('PortableExperiences')
// export class PortableExperiences extends ExposableAPI {
//   /**
//    * Starts a portable experience.
//    * @param  {SpawnPortableExperienceParameters} [pid] - Information to identify the PE
//    *
//    * Returns the handle of the portable experience.
//    */
//   @exposeMethod
//   async spawn(pid: PortableExperienceUrn): Promise<PortableExperienceHandle> {
//     const parcelIdentity: ParcelIdentity = this.options.getAPIInstance(ParcelIdentity)
//     return await spawnScenePortableExperienceSceneFromUrn(pid, parcelIdentity.cid)
//   }

//   /**
//    * Stops a portable experience. Only the executor that spawned the portable experience has permission to kill it.
//    * @param  {string} [pid] - The portable experience process id
//    *
//    * Returns true if was able to kill the portable experience, false if not.
//    */
//   @exposeMethod
//   async kill(pid: PortableExperienceUrn): Promise<boolean> {
//     const parcelIdentity: ParcelIdentity = this.options.getAPIInstance(ParcelIdentity)
//     const portableExperience = getRunningPortableExperience(pid)

//     if (!!portableExperience && portableExperience.parentCid === parcelIdentity.cid) {
//       store.dispatch(removeScenePortableExperience(pid))
//       return true
//     }
//     return false
//   }

//   /**
//    * Stops a portable experience from the current running portable scene.
//    *
//    * Returns true if was able to kill the portable experience, false if not.
//    */
//   @exposeMethod
//   async exit(): Promise<boolean> {
//     const parcelIdentity: ParcelIdentity = this.options.getAPIInstance(ParcelIdentity)
//     store.dispatch(removeScenePortableExperience(parcelIdentity.cid))
//     return true
//   }

//   /**
//    *
//    * Returns current portable experiences loaded with ids and parentCid
//    */
//   @exposeMethod
//   async getPortableExperiencesLoaded(): Promise<LoadedPortableExperiences[]> {
//     const loaded = getPortableExperiencesLoaded()
//     return Array.from(loaded).map(($) => ({ pid: $.data.sceneId, parentCid: $.parentCid }))
//   }
// }
import { RpcServerPort } from '@dcl/rpc'
import { PortContext } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { PortableExperiencesServiceDefinition } from './../gen/PortableExperiences'
import { avatarMessageObservable } from 'shared/comms/peers'
import defaultLogger from 'shared/logger'

export function registerPortableExperiencesServiceServerImplementation(
  port: RpcServerPort<PortContext>,
  ctx: PortContext
) {
  avatarMessageObservable.add((event: any) => {
    ctx.eventChannel.push({ id: 'AVATAR_OBSERVABLE', data: event }).catch((err) => defaultLogger.error(err))
  })
  codegen.registerService(port, PortableExperiencesServiceDefinition, async () => ({
    async realSpawn() {
      return {} as any
    },
    async realKill() {
      return {} as any
    },
    async realExit() {
      return {} as any
    },
    async realGetPortableExperiencesLoaded() {
      return {} as any
    }
  }))
}
