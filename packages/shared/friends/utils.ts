/**
 * The channel name should always match with the regex: ^[a-zA-Z0-9-]{3,20}$
 * @param channelId a string with the channelId to validate
 * */
export function validateRegexChannelId(channelId: string) {
  const regex = /^[a-zA-Z0-9-]{3,20}$/

  if (channelId.match(regex)) return true

  return false
}

export const CHANNEL_RESERVED_IDS = ['nearby']
