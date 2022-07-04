import { Avatar } from '@dcl/schemas'
import { ProfilesAsPromise } from 'shared/profiles/ProfileAsPromise'
import { ProfileType } from 'shared/profiles/types'

export async function ensureFriendProfile(userId: string): Promise<Avatar> {
  return ensureFriendsProfile([userId])[0]
}

export async function ensureFriendsProfile(userIds: string[]): Promise<Avatar[]> {
  return ProfilesAsPromise(userIds, undefined, ProfileType.DEPLOYED) // Friends are always deployed ATM
}
