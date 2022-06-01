import * as codegen from '@dcl/rpc/dist/codegen'
import { RpcClientPort } from '@dcl/rpc/dist/types'
import { PortableExperiencesServiceDefinition } from '../gen/PortableExperiences'
type PortableExperienceUrn = string
type PortableExperienceHandle = {
  pid: PortableExperienceUrn
  parentCid: string // Identifier of who triggered the PE to allow to kill it only to who created it
}
type PortableExperienceLoaded = {
  portableExperiences: PortableExperienceHandle[]
}
export async function createPortableExperiencesServiceClient<Context>(clientPort: RpcClientPort) {
  const realService = await codegen.loadService<Context, PortableExperiencesServiceDefinition>(
    clientPort,
    PortableExperiencesServiceDefinition
  )

  return {
    ...realService,

    /**
     * Starts a portable experience.
     * @param  {SpawnPortableExperienceParameters} [pid] - Information to identify the PE
     *
     * Returns the handle of the portable experience.
     */
    async spawn(pid: PortableExperienceUrn): Promise<PortableExperienceHandle> {
      return await realService.realSpawn({ pid })
    },

    /**
     * Stops a portable experience. Only the executor that spawned the portable experience has permission to kill it.
     * @param  {string} [pid] - The portable experience process id
     *
     * Returns true if was able to kill the portable experience, false if not.
     */
    async kill(pid: PortableExperienceUrn): Promise<boolean> {
      return (await realService.realKill({ pid })).status
    },

    /**
     * Stops a portable experience from the current running portable scene.
     *
     * Returns true if was able to kill the portable experience, false if not.
     */
    async exit(): Promise<boolean> {
      return (await realService.realExit({})).status
    },

    /**
     *
     * Returns current portable experiences loaded with ids and parentCid
     */
    async getPortableExperiencesLoaded(): Promise<PortableExperienceLoaded> {
      return {
        portableExperiences: (await realService.realGetPortableExperiencesLoaded({})).loaded
      }
    }
  }
}
