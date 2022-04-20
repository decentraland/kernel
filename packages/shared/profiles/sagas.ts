import { EntityType } from 'dcl-catalyst-commons'
import { ContentClient, DeploymentData } from 'dcl-catalyst-client'
import { call, throttle, put, select, takeEvery, takeLatest } from 'redux-saga/effects'
import { hashV1 } from '@dcl/hashing'

import { ethereumConfigurations, RESET_TUTORIAL, ETHEREUM_NETWORK, PREVIEW } from 'config'
import defaultLogger from 'shared/logger'
import {
  PROFILE_REQUEST,
  PROFILE_SUCCESS,
  SAVE_PROFILE_DELTA,
  ProfileRequestAction,
  profileSuccess,
  ProfileSuccessAction,
  SaveProfileDelta,
  sendProfileToRenderer,
  saveProfileFailure,
  addedProfileToCatalog,
  saveProfileDelta,
  LOCAL_PROFILE_RECEIVED,
  LocalProfileReceived,
  deployProfile,
  DEPLOY_PROFILE_REQUEST,
  deployProfileSuccess,
  deployProfileFailure,
  profileSavedNotDeployed,
  DeployProfile,
  PROFILE_SAVED_NOT_DEPLOYED,
  DEPLOY_PROFILE_SUCCESS,
  announceProfile
} from './actions'
import { getCurrentUserProfile, getProfile, hasConnectedWeb3 } from './selectors'
import { processServerProfile } from './transformations/processServerProfile'
import { profileToRendererFormat } from './transformations/profileToRendererFormat'
import { buildServerMetadata, ensureAvatarCompatibilityFormat } from './transformations/profileToServerFormat'
import { ContentFile, ProfileType } from './types'
import { ExplorerIdentity } from 'shared/session/types'
import { Authenticator } from 'dcl-crypto'
import { getUpdateProfileServer, getCatalystServer } from '../dao/selectors'
import { backupProfile } from 'shared/profiles/generateRandomUserProfile'
import { takeLatestById } from './utils/takeLatestById'
import { getCurrentUserId, getCurrentIdentity, getCurrentNetwork, isCurrentUserId } from 'shared/session/selectors'
import { USER_AUTHENTIFIED } from 'shared/session/actions'
import { ProfileAsPromise } from './ProfileAsPromise'
import { fetchOwnedENS } from 'shared/web3'
import { waitForRealmInitialized } from 'shared/dao/sagas'
import { waitForRendererInstance } from 'shared/renderer/sagas'
import { base64ToBuffer } from 'atomicHelpers/base64ToBlob'
import { LocalProfilesRepository } from './LocalProfilesRepository'
import { getProfileType } from './getProfileType'
import { BringDownClientAndShowError, ErrorContext, ReportFatalError } from 'shared/loading/ReportFatalError'
import { UNEXPECTED_ERROR } from 'shared/loading/types'
import { fetchParcelsWithAccess } from './fetchLand'
import { ParcelsWithAccess } from '@dcl/legacy-ecs'
import { getUnityInstance } from 'unity-interface/IUnityInterface'
import { store } from 'shared/store/isolatedStore'
import { createFakeName } from './utils/fakeName'
import { getCommsContext } from 'shared/comms/selectors'
import { CommsContext } from 'shared/comms/context'
import { requestLocalProfileToPeers } from 'shared/comms/handlers'
import { Avatar, Profile, Snapshots } from '@dcl/schemas'
import { validateAvatar } from './schemaValidation'
import { trackEvent } from 'shared/analytics'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const toBuffer = require('blob-to-buffer')

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
  yield takeEvery(USER_AUTHENTIFIED, initialProfileLoad)
  yield takeEvery(PROFILE_REQUEST, handleFetchProfile)
  yield takeEvery(PROFILE_SUCCESS, submitProfileToRenderer)
  yield takeEvery(LOCAL_PROFILE_RECEIVED, handleLocalProfile)
  yield throttle(3000, DEPLOY_PROFILE_REQUEST, handleDeployProfile)
  yield takeLatest(SAVE_PROFILE_DELTA, handleSaveAvatar)

  // Forwarding effects
  yield takeLatest([DEPLOY_PROFILE_SUCCESS, PROFILE_SAVED_NOT_DEPLOYED], announceNewAvatar)
}

function* announceNewAvatar(action: { type: string; payload: { userId: string; version: number } }) {
  yield put(announceProfile(action.payload.userId, action.payload.version))
}

function* initialProfileLoad() {
  yield call(waitForRealmInitialized)

  // initialize profile
  const identity: ExplorerIdentity = yield select(getCurrentIdentity)
  const userId = identity.address

  let profile: Avatar

  try {
    profile = yield call(ProfileAsPromise, userId, undefined, getProfileType(identity))
  } catch (e: any) {
    ReportFatalError(e, ErrorContext.KERNEL_INIT, { userId: userId })
    BringDownClientAndShowError(UNEXPECTED_ERROR)
    throw e
  }

  let profileDirty: boolean = false

  if (!profile.hasClaimedName) {
    const net: ETHEREUM_NETWORK = yield select(getCurrentNetwork)
    const names: string[] = yield call(fetchOwnedENS, ethereumConfigurations[net].names, userId)

    // patch profile to re-add missing name
    profile = { ...profile, name: names[0], hasClaimedName: true, tutorialStep: 0xff }

    if (names && names.length > 0) {
      defaultLogger.info(`Found missing claimed name '${names[0]}' for profile ${userId}, consolidating profile... `)
      profileDirty = true
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
  const { userId, profileType, version } = action.payload

  const identity: ExplorerIdentity | undefined = yield select(getCurrentIdentity)
  const commsContext: CommsContext | undefined = yield select(getCommsContext)
  if (!identity) throw new Error("Can't fetch profile if there is no ExplorerIdentity")

  const lookingForMyProfile = yield select(isCurrentUserId, userId)

  let profile: Avatar | null = null
  let hasConnectedWeb3 = false
  try {
    if ((PREVIEW || profileType === ProfileType.LOCAL) && !lookingForMyProfile && commsContext) {
      const peerProfile: Avatar = yield call(requestLocalProfileToPeers, commsContext, userId)
      if (peerProfile) {
        profile = ensureAvatarCompatibilityFormat(peerProfile)
        profile.hasClaimedName = false // for now, comms profiles can't have claimed names
      }
    } else {
      profile = yield call(getRemoteProfile, userId, version)
      if (profile) {
        profile.hasClaimedName = !!profile.name && profile.hasClaimedName // old lambdas profiles don't have claimed names if they don't have the "name" property
        hasConnectedWeb3 = true
      }
    }
  } catch (error) {
    // we throw here because it seems this is an unrecoverable error
    throw new Error(`Error requesting profile for ${userId}: ${error}`)
  }
  if (lookingForMyProfile && !profile) {
    const net: ETHEREUM_NETWORK = yield select(getCurrentNetwork)
    profile = yield call(fetchProfileLocally, userId, net)
  }
  if (!profile) {
    profile = yield call(generateRandomUserProfile, userId)
  }

  profile!.email = ''
  const avatar: Avatar = yield call(processServerProfile, userId, profile!)
  yield put(profileSuccess(userId, avatar, hasConnectedWeb3))
}

function* getRemoteProfile(userId: string, version?: number) {
  try {
    const profiles: { avatars: Avatar[] } = yield call(profileServerRequest, userId, version)

    const avatar = profiles.avatars[0]

    if (avatar && validateAvatar(avatar)) {
      return avatar
    }
  } catch (error: any) {
    if (error.message !== 'Profile not found') {
      defaultLogger.log(`Error requesting profile for auth check ${userId}, `, error)
    }
  }
  return null
}

export async function profileServerRequest(userId: string, version?: number) {
  const state = store.getState()
  const catalystUrl = getCatalystServer(state)

  try {
    let url = `${catalystUrl}/lambdas/profiles?id=${userId}`
    if (version) url = url + `&version=${version}`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Invalid response from ${url}`)
    }

    const res = await response.json()

    return res[0] || { avatars: [] }
  } catch (e: any) {
    defaultLogger.error(e)
    return { avatars: [] }
  }
}

function* handleLocalProfile(action: LocalProfileReceived) {
  const { userId, profile } = action.payload

  const existingProfile: Avatar = yield select(getProfile, userId)
  const connectedWeb3: boolean = yield select(hasConnectedWeb3, userId)

  if (!existingProfile || existingProfile.version < profile.version) {
    yield put(profileSuccess(userId, profile, connectedWeb3))
  }
}

function* submitProfileToRenderer(action: ProfileSuccessAction): any {
  const { profile, userId, hasConnectedWeb3 } = action.payload

  yield call(waitForRendererInstance)

  if (yield select(isCurrentUserId, userId)) {
    const avatar: Avatar | null = yield select(getCurrentUserProfile)
    if (!avatar) {
      debugger
      throw new Error('Avatar not available for Unity')
    }
    const identity: ExplorerIdentity = yield select(getCurrentIdentity)
    const parcels: ParcelsWithAccess = !hasConnectedWeb3 ? [] : yield call(fetchParcelsWithAccess, userId)
    const forRenderer = profileToRendererFormat(avatar, { identity, parcels })
    forRenderer.hasConnectedWeb3 = hasConnectedWeb3
    getUnityInstance().LoadProfile(forRenderer)
  } else {
    const forRenderer = profileToRendererFormat(profile, {})
    forRenderer.hasConnectedWeb3 = hasConnectedWeb3
    getUnityInstance().AddUserProfileToCatalog(forRenderer)
    yield put(addedProfileToCatalog(userId, profile))
  }
}

function* handleSaveAvatar(saveAvatar: SaveProfileDelta) {
  const userId: string = yield select(getCurrentUserId)

  try {
    const savedProfile: Avatar | null = yield select(getCurrentUserProfile)
    const currentVersion: number = savedProfile?.version && savedProfile?.version > 0 ? savedProfile?.version : 0

    const identity: ExplorerIdentity = yield select(getCurrentIdentity)
    const network: ETHEREUM_NETWORK = yield select(getCurrentNetwork)

    const profile = {
      ...savedProfile,
      ...saveAvatar.payload.profile,
      userId,
      version: currentVersion,
      ethAddress: identity.address
    } as Avatar

    if (!validateAvatar(profile)) {
      trackEvent('invalid_schema', {
        schema: 'avatar',
        payload: profile
      })
      debugger
    }

    yield localProfilesRepo.persist(identity.address, network, profile)

    yield put(sendProfileToRenderer(userId, profile.version, profile))

    // only update profile on server if wallet is connected
    if (identity.hasConnectedWeb3) {
      yield put(deployProfile(profile))
    } else {
      yield put(profileSavedNotDeployed(userId, profile.version, profile))
    }
  } catch (error: any) {
    trackEvent('error_fatal', {
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
    yield call(modifyAvatar, {
      url,
      userId,
      identity,
      profile
    })
    yield put(deployProfileSuccess(userId, profile.version, profile))
  } catch (e: any) {
    trackEvent('error_fatal', { context: 'kernel#saga', message: 'error deploying profile', stack: e.stacktrace })
    defaultLogger.error('Error deploying profile!', e)
    yield put(deployProfileFailure(userId, profile, e))
  }
}

export async function fetchProfileLocally(address: string, network: ETHEREUM_NETWORK): Promise<Avatar | null> {
  const profile = (await localProfilesRepo.get(address, network)) as Avatar | null
  if (profile && profile.userId === address) {
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

async function modifyAvatar(params: { url: string; userId: string; identity: ExplorerIdentity; profile: Avatar }) {
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
      contentFile && files.set(contentFile.name, contentFile.content)
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

function makeContentFile(path: string, content: string | Blob | Buffer): Promise<ContentFile> {
  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(content)) {
      resolve({ name: path, content })
    } else if (typeof content === 'string') {
      const buffer = Buffer.from(content)
      resolve({ name: path, content: buffer })
    } else if (content instanceof Blob) {
      toBuffer(content, (err: Error, buffer: Buffer) => {
        if (err) reject(err)
        resolve({ name: path, content: buffer })
      })
    } else {
      reject(new Error('Unable to create ContentFile: content must be a string or a Blob'))
    }
  })
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

async function generateRandomUserProfile(userId: string): Promise<Avatar> {
  defaultLogger.info('Generating random profile for ' + userId)

  const _number = randomBetween(1, 160)

  let profile: Avatar | undefined = undefined
  try {
    const profiles: { avatars: Avatar[] } = await profileServerRequest(`default${_number}`)
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
