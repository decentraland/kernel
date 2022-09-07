import { Avatar } from '@dcl/schemas'
import { ProfileAsPromise } from 'shared/profiles/ProfileAsPromise'
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
