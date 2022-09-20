import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { PortableExperiencesServiceDefinition } from 'shared/protocol/kernel/apis/PortableExperiences.gen'

type PortableExperienceUrn = string
type PortableExperienceHandle = {
  pid: PortableExperienceUrn
  parentCid: string // Identifier of who triggered the PE to allow to kill it only to who created it
}
type PortableExperienceLoaded = {
  portableExperiences: PortableExperienceHandle[]
}

export namespace PortableExperienceServiceClient {
  export function create<Context>(clientPort: RpcClientPort) {
    return codegen.loadService<Context, PortableExperiencesServiceDefinition>(
      clientPort,
      PortableExperiencesServiceDefinition
    )
  }
  export function createLegacy<Context>(clientPort: RpcClientPort) {
    const originalService = codegen.loadService<Context, PortableExperiencesServiceDefinition>(
      clientPort,
      PortableExperiencesServiceDefinition
    )

    return {
      ...originalService,

      /**
       * Starts a portable experience.
       * @param  {SpawnPortableExperienceParameters} [pid] - Information to identify the PE
       *
       * Returns the handle of the portable experience.
       */
      async spawn(pid: PortableExperienceUrn): Promise<PortableExperienceHandle> {
        return await originalService.spawn({ pid })
      },

      /**
       * Stops a portable experience. Only the executor that spawned the portable experience has permission to kill it.
       * @param  {string} [pid] - The portable experience process id
       *
       * Returns true if was able to kill the portable experience, false if not.
       */
      async kill(pid: PortableExperienceUrn): Promise<boolean> {
        return (await originalService.kill({ pid })).status
      },

      /**
       * Stops a portable experience from the current running portable scene.
       *
       * Returns true if was able to kill the portable experience, false if not.
       */
      async exit(): Promise<boolean> {
        return (await originalService.exit({})).status
      },

      /**
       *
       * Returns current portable experiences loaded with ids and parentCid
       */
      async getPortableExperiencesLoaded(): Promise<PortableExperienceLoaded> {
        return {
          portableExperiences: (await originalService.getPortableExperiencesLoaded({})).loaded
        }
      }
    }
  }
}
