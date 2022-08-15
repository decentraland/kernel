import { Avatar } from '@dcl/schemas'
import { ProfileAsPromise, ProfilesAsPromise } from 'shared/profiles/ProfileAsPromise'
import { ProfileType } from 'shared/profiles/types'

export async function ensureFriendProfile(userId: string): Promise<Avatar> {
  return ProfileAsPromise(userId)
}

export async function ensureFriendsProfile(userIds: string[]): Promise<Avatar[]> {
  return ProfilesAsPromise(userIds, ProfileType.DEPLOYED) // Friends are always deployed ATM
}
