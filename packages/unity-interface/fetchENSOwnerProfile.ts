import { isAddress } from 'eth-connect'
import { ethereumConfigurations } from 'config'
import { fetchENSOwnersContains, getAppNetwork } from 'shared/web3'
import { ProfileType } from 'shared/profiles/types'
import { ensureFriendProfile } from 'shared/profiles/ProfileAsPromise'
import { Avatar } from '@dcl/schemas'

export async function fetchENSOwnerProfile(name: string, maxResults: number = 1): Promise<Avatar[]> {
  let userIds: string[]

  if (isAddress(name)) {
    userIds = [name]
  } else {
    const net = await getAppNetwork()
    userIds = await fetchENSOwnersContains(ethereumConfigurations[net].names, name, maxResults)
  }

  return Promise.all(userIds.map((userId) => ensureFriendProfile(userId, undefined, ProfileType.DEPLOYED)))
}
