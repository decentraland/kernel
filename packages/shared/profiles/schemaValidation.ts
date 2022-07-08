import { Avatar, AvatarInfo, generateLazyValidator, JSONSchema } from '@dcl/schemas'

/**
 * The schema validation requires strict IPFS "snapshots"
 * The following schema uses strings
 */
const stringSnapshotAvatarInfoSchema: JSONSchema<AvatarInfo> = {
  ...(AvatarInfo.schema as any),
  properties: {
    ...(AvatarInfo.schema as any).properties,
    snapshots: { type: 'object', additionalProperties: true, required: [] }
  }
} as any

const stringSnapshotAvatarSchema: JSONSchema<Avatar> = {
  ...(Avatar.schema as any),
  properties: {
    ...(Avatar.schema as any).properties,
    avatar: stringSnapshotAvatarInfoSchema
  }
} as any

export const validateAvatar = generateLazyValidator<Avatar>(stringSnapshotAvatarSchema)
