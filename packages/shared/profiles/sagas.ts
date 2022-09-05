import { EntityType } from 'dcl-catalyst-commons'
import { ContentClient, DeploymentData } from 'dcl-catalyst-client'
import { call, put, select, takeEvery, fork, take, debounce, apply, CallEffect } from 'redux-saga/effects'
import { hashV1 } from '@dcl/hashing'

import { ethereumConfigurations, RESET_TUTORIAL, ETHEREUM_NETWORK } from 'config'
import defaultLogger from 'shared/logger'
import {
  PROFILE_REQUEST,
  SAVE_PROFILE,
  ProfileRequestAction,
  SaveProfileDelta,
  sendProfileToRenderer,
  saveProfileFailure,
  saveProfileDelta,
  deployProfile,
  DEPLOY_PROFILE_REQUEST,
  deployProfileSuccess,
  deployProfileFailure,
  DeployProfile,
  profileSuccess,
  PROFILE_SUCCESS,
  ProfileSuccessAction,
  profileFailure,
  PROFILES_REQUEST,
  ProfilesRequestAction,
  profilesSuccess,
  profilesFailure
} from './actions'
import { getCurrentUserProfileDirty, getProfileFromStore } from './selectors'
import { buildServerMetadata, ensureAvatarCompatibilityFormat } from './transformations/profileToServerFormat'
import { ContentFile, ProfileType, ProfileUserInfo, RemoteProfile, REMOTE_AVATAR_IS_INVALID } from './types'
import { ExplorerIdentity } from 'shared/session/types'
import { Authenticator } from '@dcl/crypto'
import { getUpdateProfileServer, getCatalystServer } from '../dao/selectors'
import { backupProfile } from 'shared/profiles/generateRandomUserProfile'
import { takeLatestById } from './utils/takeLatestById'
import { getCurrentUserId, getCurrentIdentity, getCurrentNetwork, isCurrentUserId } from 'shared/session/selectors'
import { USER_AUTHENTIFIED } from 'shared/session/actions'
import { ProfileAsPromise } from './ProfileAsPromise'
import { fetchOwnedENS } from 'shared/web3'
import { waitForRealmInitialized } from 'shared/dao/sagas'
import { base64ToBuffer } from 'atomicHelpers/base64ToBlob'
import { LocalProfilesRepository } from './LocalProfilesRepository'
import { BringDownClientAndShowError, ErrorContext, ReportFatalError } from 'shared/loading/ReportFatalError'
import { UNEXPECTED_ERROR } from 'shared/loading/types'
import { store } from 'shared/store/isolatedStore'
import { createFakeName } from './utils/fakeName'
import { getCommsContext } from 'shared/comms/selectors'
import { CommsContext } from 'shared/comms/context'
import { createReceiveProfileOverCommsChannel, requestProfileToPeers } from 'shared/comms/handlers'
import { Avatar, Profile, Snapshots } from '@dcl/schemas'
import { validateAvatar } from './schemaValidation'
import { trackEvent } from 'shared/analytics'
import { EventChannel } from 'redux-saga'
import { getIdentity } from 'shared/session'

const concatenatedActionTypeUserId = (action: { type: string; payload: { userId: string } }) =>
  action.type + action.payload.userId

export const takeLatestByUserId = (patternOrChannel: any, saga: any, ...args: any) =>
  takeLatestById(patternOrChannel, concatenatedActionTypeUserId, saga, ...args)

// This repository is for local profiles owned by this browser (without wallet)
export const localProfilesRepo = new LocalProfilesRepository()

/**
 * This saga handles both passports and assets required for the renderer to show the
 * users' inventory and avatar editor.
 *
 * When the renderer is initialized, it will fetch the asset catalog and submit it to the renderer.
 *
 * Whenever a passport is requested, it will fetch it and store it locally (see also: `selectors.ts`)
 *
 * If a user avatar was not found, it will create a random passport (see: `handleRandomAsSuccess`)
 *
 * Lastly, we handle save requests by submitting both to the avatar legacy server as well as to the profile server.
 *
 * It's *very* important for the renderer to never receive a passport with items that have not been loaded into the catalog.
 */
export function* profileSaga(): any {
  yield takeEvery(USER_AUTHENTIFIED, initialRemoteProfileLoad)
  yield takeLatestByUserId(PROFILE_REQUEST, handleFetchProfile)
  yield takeLatestByUserId(PROFILE_SUCCESS, forwardProfileToRenderer)
  yield takeEvery(PROFILES_REQUEST, handleFetchProfiles)
  yield fork(handleCommsProfile)
  yield debounce(200, DEPLOY_PROFILE_REQUEST, handleDeployProfile)
  yield takeEvery(SAVE_PROFILE, handleSaveLocalAvatar)
}

function* forwardProfileToRenderer(action: ProfileSuccessAction) {
  yield put(sendProfileToRenderer(action.payload.profile.userId))
}

function* initialRemoteProfileLoad() {
  yield call(waitForRealmInitialized)

  // initialize profile
  const identity: ExplorerIdentity = yield select(getCurrentIdentity)
  const isGuest = !identity.hasConnectedWeb3
  const userId = identity.address

  let profile: Avatar

  try {
    profile = yield call(ProfileAsPromise, userId, isGuest ? ProfileType.LOCAL : ProfileType.DEPLOYED)
  } catch (e: any) {
    ReportFatalError(e, ErrorContext.KERNEL_INIT, { userId })
    BringDownClientAndShowError(UNEXPECTED_ERROR)
    throw e
  }

  let profileDirty: boolean = false

  const net: ETHEREUM_NETWORK = yield select(getCurrentNetwork)
  const names: string[] = yield call(fetchOwnedENS, ethereumConfigurations[net].names, userId)

  // check that the user still has the claimed name, otherwise pick one
  function selectClaimedName() {
    if (names.length) {
      defaultLogger.info(`Found missing claimed name '${names[0]}' for profile ${userId}, consolidating profile... `)
      profile = { ...profile, name: names[0], hasClaimedName: true, tutorialStep: 0xfff }
    } else {
      profile = { ...profile, hasClaimedName: false, tutorialStep: 0x0 }
    }
    profileDirty = true
  }

  if (profile.hasClaimedName || names.length) {
    if (!names.includes(profile.name)) {
      selectClaimedName()
    }
  }

  if (RESET_TUTORIAL) {
    profile = { ...profile, tutorialStep: 0 }
    profileDirty = true
  }

  // if the profile is dirty, then save it
  if (profileDirty) {
    yield put(saveProfileDelta(profile))
  }
}

export function* handleFetchProfile(action: ProfileRequestAction): any {
  const { userId, version } = action.payload

  const identity: ExplorerIdentity | undefined = yield select(getCurrentIdentity)
  const commsContext: CommsContext | undefined = yield select(getCommsContext)

  if (!identity) throw new Error("Can't fetch profile if there is no ExplorerIdentity")

  try {
    const shouldReadProfileFromLocalStorage = yield select(isCurrentUserId, userId)
    const shouldFetchViaComms = commsContext && !shouldReadProfileFromLocalStorage
    const shouldLoadFromCatalyst = true

    const profile: Avatar =
      // first fetch avatar through comms
      (shouldFetchViaComms && (yield call(requestProfileToPeers, commsContext, userId, version))) ||
      // and then via catalyst
      (shouldLoadFromCatalyst && (yield call(getRemoteProfile, userId, version))) ||
      // then for my profile, try localStorage
      (shouldReadProfileFromLocalStorage && (yield call(readProfileFromLocalStorage)))

    const avatar: Avatar = ensureAvatarCompatibilityFormat(profile)
    avatar.userId = userId

    if (shouldReadProfileFromLocalStorage) {
      // for local user, hasConnectedWeb3 == identity.hasConnectedWeb3
      const identity: ExplorerIdentity | undefined = yield call(getIdentity)
      avatar.hasConnectedWeb3 = identity?.hasConnectedWeb3 || avatar.hasConnectedWeb3
    }

    yield put(profileSuccess(avatar))
  } catch (error: any) {
    debugger
    trackEvent('error', {
      context: 'kernel#saga',
      message: `Error requesting profile for ${userId}: ${error}`,
      stack: error.stack || ''
    })
    yield put(profileFailure(userId, `${error}`))
  }
}

export function* handleFetchProfiles(action: ProfilesRequestAction): any {
  const { userIds } = action.payload

  const identity: ExplorerIdentity | undefined = yield select(getCurrentIdentity)

  if (!identity) throw new Error("Can't fetch profile if there is no ExplorerIdentity")

  try {
    const userIdsToFetch = userIds.filter((userId) => userId.toLowerCase() !== identity.address.toLowerCase())
    const isFetchingOwnUser = userIds.some((userId) => userId.toLowerCase() === identity.address.toLowerCase())

    const avatars: Avatar[] = yield (!isFetchingOwnUser && call(getRemoteProfiles, userIdsToFetch)) || []

    const ownProfile: Avatar | null = isFetchingOwnUser && (yield call(readProfileFromLocalStorage))
    if (ownProfile && ownProfile.userId.length > 0) {
      avatars.push(ownProfile)
    }

    yield put(profilesSuccess(avatars))
  } catch (error: any) {
    trackEvent('error', {
      context: 'kernel#saga',
      message: `Error requesting profiles for ${userIds}: ${error}`,
      stack: error.stack || ''
    })
    yield put(profilesFailure(userIds, `${error}`))
  }
}

function* getRemoteProfile(
  userId: string,
  version?: number
): Generator<CallEffect<RemoteProfile> | CallEffect<Array<Avatar>> | RemoteProfile> {
  try {
    const remoteProfile: RemoteProfile = (yield call(profileServerRequest, userId, version)) as RemoteProfile

    const profiles: Avatar[] = (yield call(processRemoteProfiles, [remoteProfile], [userId])) as Array<Avatar>
    return profiles[0]
  } catch (error: any) {
    if (error.message !== 'Profiles not found') {
      defaultLogger.log(`Error requesting profile for auth check ${userId}, `, error)
    }
  }
  return null
}

function* getRemoteProfiles(
  userIds: string[]
): Generator<CallEffect<RemoteProfile[]> | CallEffect<Array<Avatar>> | Array<Avatar>> {
  try {
    const remoteProfiles: RemoteProfile[] = (yield call(profilesServerRequest, userIds)) as Array<RemoteProfile>

    const profiles: Avatar[] = (yield call(processRemoteProfiles, remoteProfiles, userIds)) as Array<Avatar>
    return profiles
  } catch (error: any) {
    if (error.message !== 'Profiles not found') {
      defaultLogger.log(`Error requesting profiles for auth check ${userIds}, `, error)
    }
  }
  return null
}

async function processRemoteProfiles(profiles: RemoteProfile[], userIds: string[]): Promise<Array<Avatar>> {
  const avatars: Array<Avatar> = profiles
    .map((profile): Avatar | null => {
      let avatar = profile.avatars[0]
      if (!avatar) {
        return null
      }

      try {
        avatar = ensureAvatarCompatibilityFormat(avatar)
        if (!validateAvatar(avatar)) {
          defaultLogger.warn(`Remote avatar for users is invalid.`, avatar, validateAvatar.errors)
          trackEvent(REMOTE_AVATAR_IS_INVALID, {
            avatar
          })
          return null
        }
      } catch (error) {
        defaultLogger.warn(`Remote avatar for users is invalid.`, avatar, validateAvatar.errors)
        trackEvent(REMOTE_AVATAR_IS_INVALID, {
          avatar
        })
        return null
      }

      avatar.hasClaimedName = !!avatar.name && avatar.hasClaimedName // old lambdas profiles don't have claimed names if they don't have the "name" property
      avatar.hasConnectedWeb3 = true

      return avatar
    })
    .filter((avatar: Avatar | null): boolean => avatar !== null) as Array<Avatar>

  // generate a random profile for users that don't have one
  // this is so that renderer can show them to the user
  // and show them in the chat so no ghost notification is left hanging
  const usersWithoutAvatars = userIds.filter((userId) => !avatars.some((avatar) => avatar.userId === userId))
  const defaultAvatars = await Promise.all(
    usersWithoutAvatars.map(async (userId): Promise<Avatar> => generateRandomUserProfile(userId))
  )

  return avatars.concat(defaultAvatars)
}

export async function profileServerRequest(userId: string, version?: number): Promise<RemoteProfile> {
  const state = store.getState()
  const catalystUrl = getCatalystServer(state)

  try {
    let url = `${catalystUrl}/lambdas/profiles?id=${userId}`
    if (version) url = url + `&version=${version}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Invalid response from ${url}`)
    }

    const res: RemoteProfile[] = await response.json()
    return res[0] || { avatars: [], timestamp: Date.now() }
  } catch (e: any) {
    defaultLogger.error(e)
    return { avatars: [], timestamp: Date.now() }
  }
}

export async function profilesServerRequest(userIds: string[]): Promise<RemoteProfile[]> {
  const state = store.getState()
  const catalystUrl = getCatalystServer(state)

  try {
    const url = `${catalystUrl}/lambdas/profiles`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: userIds })
    })

    if (!response.ok) {
      throw new Error(`Invalid response from ${url}`)
    }

    const res = await response.json()

    return res || [{ avatars: [], timestamp: Date.now }]
  } catch (e: any) {
    defaultLogger.error(e)
    return [{ avatars: [], timestamp: Date.now() }]
  }
}

/**
 * Handle comms profiles. If we have the profile then it calls a profileSuccess to
 * store it and forward it to the renderer.
 */
function* handleCommsProfile() {
  const chan: EventChannel<Avatar> = yield call(createReceiveProfileOverCommsChannel)

  while (true) {
    // TODO: Mendez, add signatures and verifications to this profile-over-comms mechanism
    const receivedProfile: Avatar = yield take(chan)
    const existingProfile: ProfileUserInfo | null = yield select(getProfileFromStore, receivedProfile.userId)

    if (!existingProfile || existingProfile.data?.version < receivedProfile.version) {
      // TEMP:
      receivedProfile.hasConnectedWeb3 = receivedProfile.hasConnectedWeb3 || false

      // store profile locally and forward to renderer
      yield put(profileSuccess(receivedProfile))
    }
  }
}

function* handleSaveLocalAvatar(saveAvatar: SaveProfileDelta) {
  const userId: string = yield select(getCurrentUserId)

  try {
    // get the avatar, no matter if it is in a loading or dirty state
    const savedProfile: Avatar | null = yield select(getCurrentUserProfileDirty)
    const currentVersion: number = Math.max(savedProfile?.version || 0, 0)

    const identity: ExplorerIdentity = yield select(getCurrentIdentity)
    const network: ETHEREUM_NETWORK = yield select(getCurrentNetwork)

    const profile: Avatar = {
      hasClaimedName: false,
      name: createFakeName(),
      description: '',
      tutorialStep: 0,
      ...savedProfile,
      ...saveAvatar.payload.profile,
      userId,
      version: currentVersion + 1,
      ethAddress: userId,
      hasConnectedWeb3: identity.hasConnectedWeb3
    } as Avatar

    if (!validateAvatar(profile)) {
      trackEvent('invalid_schema', {
        schema: 'avatar',
        payload: profile,
        errors: (validateAvatar.errors ?? []).map(($) => $.message).join(',')
      })
    }

    // save the profile in the local storage
    yield apply(localProfilesRepo, 'persist', [profile.ethAddress, network, profile])

    // save the profile in the store
    yield put(profileSuccess(profile))

    // only update profile on server if wallet is connected
    if (profile.hasConnectedWeb3) {
      yield put(deployProfile(profile))
    }
  } catch (error: any) {
    trackEvent('error', {
      message: `cant_persist_avatar ${error}`,
      context: 'kernel#saga',
      stack: error.stacktrace
    })
    yield put(saveProfileFailure(userId, 'unknown reason'))
  }
}

function* handleDeployProfile(deployProfileAction: DeployProfile) {
  const url: string = yield select(getUpdateProfileServer)
  const identity: ExplorerIdentity = yield select(getCurrentIdentity)
  const userId: string = yield select(getCurrentUserId)
  const profile: Avatar = deployProfileAction.payload.profile
  try {
    yield call(deployAvatar, {
      url,
      userId,
      identity,
      profile
    })
    yield put(deployProfileSuccess(userId, profile.version, profile))
  } catch (e: any) {
    trackEvent('error', {
      context: 'kernel#saga',
      message: 'error deploying profile. ' + e.message,
      stack: e.stacktrace
    })
    defaultLogger.error('Error deploying profile!', e)
    yield put(deployProfileFailure(userId, profile, e))
  }
}

function* readProfileFromLocalStorage() {
  const network: ETHEREUM_NETWORK = yield select(getCurrentNetwork)
  const identity: ExplorerIdentity = yield select(getIdentity)
  const profile = (yield apply(localProfilesRepo, localProfilesRepo.get, [identity.address, network])) as Avatar | null
  if (profile && profile.userId === identity.address) {
    return ensureAvatarCompatibilityFormat(profile)
  } else {
    return null
  }
}

async function buildSnapshotContent(selector: string, value: string) {
  let hash: string
  let contentFile: ContentFile | undefined

  const name = `${selector}.png`

  if (value.includes('://')) {
    // value is already a URL => use existing hash
    hash = value.split('/').pop()!
  } else {
    // value is coming in base 64 => convert to blob & upload content
    const buffer = base64ToBuffer(value)
    contentFile = await makeContentFile(name, buffer)
    hash = await hashV1(contentFile.content)
  }

  return { name, hash, contentFile }
}

async function deployAvatar(params: { url: string; userId: string; identity: ExplorerIdentity; profile: Avatar }) {
  const { url, profile, identity } = params
  const { avatar } = profile

  const newAvatar = { ...avatar }

  const files = new Map<string, Buffer>()

  const snapshots = avatar.snapshots || (profile as any).snapshots
  const content = new Map()

  if (snapshots) {
    const newSnapshots: Record<string, string> = {}
    for (const [selector, value] of Object.entries(snapshots)) {
      const { name, hash, contentFile } = await buildSnapshotContent(selector, value as any)

      newSnapshots[selector] = hash
      content.set(name, hash)
      contentFile && files.set(contentFile.name, Buffer.from(contentFile.content))
    }
    newAvatar.snapshots = newSnapshots as Snapshots
  }

  const metadata = buildServerMetadata({ ...profile, avatar: newAvatar })

  return deploy(url, identity, metadata, files, content)
}

async function deploy(
  url: string,
  identity: ExplorerIdentity,
  metadata: Profile,
  contentFiles: Map<string, Buffer>,
  contentHashes: Map<string, string>
) {
  // Build the client
  const catalyst = new ContentClient({ contentUrl: url })

  const entityWithoutNewFilesPayload = {
    type: EntityType.PROFILE,
    pointers: [identity.address],
    hashesByKey: contentHashes,
    metadata
  }

  // Build entity and group all files
  const preparationData = await (contentFiles.size
    ? catalyst.buildEntity({ type: EntityType.PROFILE, pointers: [identity.address], files: contentFiles, metadata })
    : catalyst.buildEntityWithoutNewFiles(entityWithoutNewFilesPayload))
  // sign the entity id
  const authChain = Authenticator.signPayload(identity, preparationData.entityId)
  // Build the deploy data
  const deployData: DeploymentData = { ...preparationData, authChain }
  // Deploy the actual entity
  return catalyst.deployEntity(deployData)
}

async function makeContentFile(path: string, content: string | Blob | Buffer): Promise<ContentFile> {
  if (Buffer.isBuffer(content)) {
    return { name: path, content }
  } else if (typeof content === 'string') {
    const buffer = Buffer.from(content)
    return { name: path, content: buffer }
  } else {
    throw new Error('Unable to create ContentFile: content must be a string or a Blob')
  }
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

async function generateRandomUserProfile(userId: string): Promise<Avatar> {
  defaultLogger.info('Generating random profile for ' + userId)

  const _number = randomBetween(1, 160)

  let profile: Avatar | undefined = undefined
  try {
    const profiles: RemoteProfile = await profilesServerRequest([`default${_number}`])[0]
    if (profiles.avatars.length !== 0) {
      profile = profiles.avatars[0]
    }
  } catch (e) {
    // in case something fails keep going and use backup profile
  }

  if (!profile) {
    profile = backupProfile(userId)
  }

  profile.ethAddress = userId
  profile.userId = userId
  profile.avatar.snapshots.face256 = profile.avatar.snapshots.face256 ?? (profile.avatar.snapshots as any).face
  profile.name = createFakeName()
  profile.hasClaimedName = false
  profile.tutorialStep = 0
  profile.version = -1 // We signal random user profiles with -1

  return ensureAvatarCompatibilityFormat(profile)
}
