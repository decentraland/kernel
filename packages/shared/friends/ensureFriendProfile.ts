import { Avatar } from '@dcl/schemas'
import { ProfileAsPromise, ProfilesAsPromise } from 'shared/profiles/ProfileAsPromise'
import { ProfileType } from 'shared/profiles/types'
import defaultLogger from 'shared/logger'
import { trackEvent } from 'shared/analytics'

export async function ensureFriendProfile(userId: string): Promise<Avatar | undefined> {
  try {
    return ProfileAsPromise(userId)
  } catch (error) {
    const message = 'Failed while ensuring friend profile'
    defaultLogger.error(message, error)

    trackEvent('error', {
      context: 'kernel#saga',
      message: message,
      stack: '' + error
    })
  }
}

export async function ensureFriendsProfile(userIds: string[]): Promise<Avatar[]> {
  return ProfilesAsPromise(userIds, ProfileType.DEPLOYED) // Friends are always deployed ATM
}
