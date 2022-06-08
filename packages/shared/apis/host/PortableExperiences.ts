import {
  spawnScenePortableExperienceSceneFromUrn,
  getPortableExperiencesLoaded,
  getRunningPortableExperience
} from '../../../unity-interface/portableExperiencesUtils'
import { store } from '../../../shared/store/isolatedStore'
import { removeScenePortableExperience } from '../../../shared/portableExperiences/actions'

import { RpcServerPort } from '@dcl/rpc'
import { PortContext } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'

import { PortableExperiencesServiceDefinition } from '../proto/PortableExperiences'

export function registerPortableExperiencesServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, PortableExperiencesServiceDefinition, async () => ({
    //   /**
    //    * Starts a portable experience.
    //    * @param  {SpawnPortableExperienceParameters} [pid] - Information to identify the PE
    //    *
    //    * Returns the handle of the portable experience.
    //    */
    async spawn(req, ctx) {
      return await spawnScenePortableExperienceSceneFromUrn(req.pid, ctx.ParcelIdentity.cid)
    },
    /**
     * Stops a portable experience. Only the executor that spawned the portable experience has permission to kill it.
     * @param  {string} [pid] - The portable experience process id
     *
     * Returns true if was able to kill the portable experience, false if not.
     */
    async kill(req, ctx) {
      const portableExperience = getRunningPortableExperience(req.pid)

      if (!!portableExperience && portableExperience.parentCid === ctx.ParcelIdentity.cid) {
        store.dispatch(removeScenePortableExperience(req.pid))
        return { status: true }
      }
      return { status: false }
    },

    /**
     * Stops a portable experience from the current running portable scene.
     *
     * Returns true if was able to kill the portable experience, false if not.
     */
    async exit(_req, ctx) {
      store.dispatch(removeScenePortableExperience(ctx.ParcelIdentity.cid))
      return { status: true }
    },

    /**
     *
     * Returns current portable experiences loaded with ids and parentCid
     */
    async getPortableExperiencesLoaded() {
      const loaded = getPortableExperiencesLoaded()
      return { loaded: Array.from(loaded).map(($) => ({ pid: $.data.sceneId, parentCid: $.parentCid })) }
    }
  }))
}
