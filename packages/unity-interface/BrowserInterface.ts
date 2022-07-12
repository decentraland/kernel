import { Quaternion, EcsMathReadOnlyQuaternion, EcsMathReadOnlyVector3, Vector3 } from '@dcl/ecs-math'

import { uuid } from 'atomicHelpers/math'
import { sendPublicChatMessage } from 'shared/comms'
import { findProfileByName } from 'shared/profiles/selectors'
import { TeleportController } from 'shared/world/TeleportController'
import { reportScenesAroundParcel } from 'shared/atlas/actions'
import { getCurrentIdentity, getCurrentUserId, getIsGuestLogin } from 'shared/session/selectors'
import { DEBUG, ethereumConfigurations, parcelLimits, playerConfigurations, WORLD_EXPLORER } from 'config'
import { renderDistanceObservable, sceneLifeCycleObservable } from '../decentraland-loader/lifecycle/controllers/scene'
import { trackEvent } from 'shared/analytics'
import {
  BringDownClientAndShowError,
  ErrorContext,
  ReportFatalErrorWithUnityPayload
} from 'shared/loading/ReportFatalError'
import { defaultLogger } from 'shared/logger'
import { profileRequest, saveProfileDelta } from 'shared/profiles/actions'
import { ProfileType } from 'shared/profiles/types'
import {
  ChatMessage,
  FriendshipUpdateStatusMessage,
  FriendshipAction,
  WorldPosition,
  LoadableParcelScene,
  AvatarRendererMessage,
  GetFriendsPayload
} from 'shared/types'
import {
  getSceneWorkerBySceneID,
  setNewParcelScene,
  stopParcelSceneWorker,
  allScenesEvent,
  AllScenesEvents,
  stopIsolatedMode,
  startIsolatedMode,
  invalidateScenesAtCoords
} from 'shared/world/parcelSceneManager'
import { getPerformanceInfo } from 'shared/session/getPerformanceInfo'
import { positionObservable } from 'shared/world/positionThings'
import { sendMessage } from 'shared/chat/actions'
import { updateFriendship, updateUserData } from 'shared/friends/actions'
import { changeRealm } from 'shared/dao'
import { notifyStatusThroughChat } from 'shared/chat'
import { fetchENSOwner } from 'shared/web3'
import { updateStatusMessage } from 'shared/loading/actions'
import { blockPlayers, mutePlayers, unblockPlayers, unmutePlayers } from 'shared/social/actions'
import { setAudioStream } from './audioStream'
import { logout, redirectToSignUp, signUp, signUpCancel } from 'shared/session/actions'
import { getIdentity, hasWallet } from 'shared/session'
import { getUnityInstance } from './IUnityInterface'
import { setDelightedSurveyEnabled } from './delightedSurvey'
import { IFuture } from 'fp-future'
import { reportHotScenes } from 'shared/social/hotScenes'
import { GIFProcessor } from 'gif-processor/processor'
import { setVoiceChatRecording, setVoicePolicy, setVoiceVolume, toggleVoiceChatRecording } from 'shared/comms/actions'
import { getERC20Balance } from 'shared/ethereum/EthereumService'
import { ensureFriendProfile } from 'shared/friends/ensureFriendProfile'
import { reloadScene } from 'decentraland-loader/lifecycle/utils/reloadScene'
import { wearablesRequest } from 'shared/catalogs/actions'
import { WearablesRequestFilters } from 'shared/catalogs/types'
import { fetchENSOwnerProfile } from './fetchENSOwnerProfile'
import { AVATAR_LOADING_ERROR, renderingActivated, renderingDectivated } from 'shared/loading/types'
import { unpublishSceneByCoords } from 'shared/apis/SceneStateStorageController/unpublishScene'
import { BuilderServerAPIManager } from 'shared/apis/SceneStateStorageController/BuilderServerAPIManager'
import { getSelectedNetwork } from 'shared/dao/selectors'
import { globalObservable } from 'shared/observables'
import { renderStateObservable } from 'shared/world/worldState'
import { store } from 'shared/store/isolatedStore'
import { signalRendererInitializedCorrectly } from 'shared/renderer/actions'
import { setRendererAvatarState } from 'shared/social/avatarTracker'
import { isAddress } from 'eth-connect'
import { getAuthHeaders } from 'atomicHelpers/signedFetch'
import { Authenticator } from '@dcl/crypto'
import { IsolatedModeOptions, StatefulWorkerOptions } from 'shared/world/types'
import { deployScene } from 'shared/apis/SceneStateStorageController/SceneDeployer'
import { DeploymentResult, PublishPayload } from 'shared/apis/SceneStateStorageController/types'
import { denyPortableExperiences, removeScenePortableExperience } from 'shared/portableExperiences/actions'
import { setDecentralandTime } from 'shared/apis/host/EnvironmentAPI'
import { Avatar, generateValidator, JSONSchema } from '@dcl/schemas'
import { getFriends } from 'shared/friends/sagas'

declare const globalThis: { gifProcessor?: GIFProcessor }
export const futures: Record<string, IFuture<any>> = {}

// ** TODO - move to friends related file - moliva - 15/07/2020
function toSocialId(userId: string) {
  const domain = store.getState().friends.client?.getDomain()
  return `@${userId.toLowerCase()}:${domain}`
}

const positionEvent = {
  position: Vector3.Zero(),
  quaternion: Quaternion.Identity,
  rotation: Vector3.Zero(),
  playerHeight: playerConfigurations.height,
  mousePosition: Vector3.Zero(),
  immediate: false, // By default the renderer lerps avatars position
  cameraQuaternion: Quaternion.Identity,
  cameraEuler: Vector3.Zero()
}

type UnityEvent = any

type SystemInfoPayload = {
  graphicsDeviceName: string
  graphicsDeviceVersion: string
  graphicsMemorySize: number
  processorType: string
  processorCount: number
  systemMemorySize: number
}

/** Message from renderer sent to save the profile in the catalyst */
export type RendererSaveProfile = {
  avatar: {
    name: string
    bodyShape: string
    skinColor: {
      r: number
      g: number
      b: number
      a: number
    }
    hairColor: {
      r: number
      g: number
      b: number
      a: number
    }
    eyeColor: {
      r: number
      g: number
      b: number
      a: number
    }
    wearables: string[]
  }
  face256: string
  body: string
  isSignUpFlow?: boolean
}
const color3Schema: JSONSchema<{ r: number; g: number; b: number; a: number }> = {
  type: 'object',
  required: ['r', 'g', 'b', 'a'],
  properties: {
    r: { type: 'number', nullable: false },
    g: { type: 'number', nullable: false },
    b: { type: 'number', nullable: false },
    a: { type: 'number', nullable: false }
  }
} as any

export const rendererSaveProfileSchema: JSONSchema<RendererSaveProfile> = {
  type: 'object',
  required: ['avatar', 'body', 'face256'],
  properties: {
    face256: { type: 'string' },
    body: { type: 'string' },
    isSignUpFlow: { type: 'boolean', nullable: true },
    avatar: {
      type: 'object',
      required: ['bodyShape', 'eyeColor', 'hairColor', 'name', 'skinColor', 'wearables'],
      properties: {
        bodyShape: { type: 'string' },
        name: { type: 'string' },
        eyeColor: color3Schema,
        hairColor: color3Schema,
        skinColor: color3Schema,
        wearables: { type: 'array', items: { type: 'string' } }
      }
    }
  }
} as any

const validateRendererSaveProfile = generateValidator<RendererSaveProfile>(rendererSaveProfileSchema)

// the BrowserInterface is a visitor for messages received from Unity
export class BrowserInterface {
  private lastBalanceOfMana: number = -1

  /**
   * This is the only method that should be called publically in this class.
   * It dispatches "renderer messages" to the correct handlers.
   *
   * It has a fallback that doesn't fail to support future versions of renderers
   * and independant workflows for both teams.
   */
  public handleUnityMessage(type: string, message: any) {
    if (type in this) {
      ;(this as any)[type](message)
    } else {
      if (DEBUG) {
        defaultLogger.info(`Unknown message (did you forget to add ${type} to unity-interface/dcl.ts?)`, message)
      }
    }
  }

  public StartIsolatedMode(options: IsolatedModeOptions) {
    startIsolatedMode(options).catch(defaultLogger.error)
  }

  public StopIsolatedMode(options: IsolatedModeOptions) {
    stopIsolatedMode(options)
  }

  public AllScenesEvent<T extends IEventNames>(data: AllScenesEvents<T>) {
    allScenesEvent(data)
  }

  /** Triggered when the camera moves */
  public ReportPosition(data: {
    position: EcsMathReadOnlyVector3
    rotation: EcsMathReadOnlyQuaternion
    playerHeight?: number
    immediate?: boolean
    cameraRotation?: EcsMathReadOnlyQuaternion
  }) {
    positionEvent.position.set(data.position.x, data.position.y, data.position.z)
    positionEvent.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w)
    positionEvent.rotation.copyFrom(positionEvent.quaternion.eulerAngles)
    positionEvent.playerHeight = data.playerHeight || playerConfigurations.height

    const cameraQuaternion = data.cameraRotation ?? data.rotation
    positionEvent.cameraQuaternion.set(cameraQuaternion.x, cameraQuaternion.y, cameraQuaternion.z, cameraQuaternion.w)
    positionEvent.cameraEuler.copyFrom(positionEvent.cameraQuaternion.eulerAngles)

    // By default the renderer lerps avatars position
    positionEvent.immediate = false

    if (data.immediate !== undefined) {
      positionEvent.immediate = data.immediate
    }

    positionObservable.notifyObservers(positionEvent)
  }

  public ReportMousePosition(data: { id: string; mousePosition: EcsMathReadOnlyVector3 }) {
    positionEvent.mousePosition.set(data.mousePosition.x, data.mousePosition.y, data.mousePosition.z)
    positionObservable.notifyObservers(positionEvent)
    futures[data.id].resolve(data.mousePosition)
  }

  public SceneEvent(data: { sceneId: string; eventType: string; payload: any }) {
    const scene = getSceneWorkerBySceneID(data.sceneId)
    if (scene) {
      scene.emit(data.eventType as IEventNames, data.payload)

      // Keep backward compatibility with old scenes using deprecated `pointerEvent`
      if (data.eventType === 'actionButtonEvent') {
        const { payload } = data.payload
        // CLICK, PRIMARY or SECONDARY
        if (payload.buttonId >= 0 && payload.buttonId <= 2) {
          scene.emit('pointerEvent', data.payload)
        }
      }
    } else {
      if (data.eventType !== 'metricsUpdate') {
        defaultLogger.error(`SceneEvent: Scene ${data.sceneId} not found`, data)
      }
    }
  }

  public OpenWebURL(data: { url: string }) {
    globalObservable.emit('openUrl', data)
  }

  public PerformanceReport(data: Record<string, unknown>) {
    let estimatedAllocatedMemory = 0
    let estimatedTotalMemory = 0
    if (getUnityInstance()?.Module?.asmLibraryArg?._GetDynamicMemorySize) {
      estimatedAllocatedMemory = getUnityInstance().Module.asmLibraryArg._GetDynamicMemorySize()
      estimatedTotalMemory = getUnityInstance().Module.asmLibraryArg._GetTotalMemorySize()
    }
    const perfReport = getPerformanceInfo({ ...(data as any), estimatedAllocatedMemory, estimatedTotalMemory })
    trackEvent('performance report', perfReport)
  }

  public SystemInfoReport(data: SystemInfoPayload) {
    trackEvent('system info report', data)

    queueMicrotask(() => {
      // send an "engineStarted" notification, use a queueMicrotask
      // to escape the current stack leveraging the JS event loop
      store.dispatch(signalRendererInitializedCorrectly())
    })
  }

  public CrashPayloadResponse(data: { payload: any }) {
    getUnityInstance().crashPayloadResponseObservable.notifyObservers(JSON.stringify(data))
  }

  public PreloadFinished(_data: { sceneId: string }) {
    // stub. there is no code about this in unity side yet
  }

  public Track(data: { name: string; properties: { key: string; value: string }[] | null }) {
    const properties: Record<string, string> = {}
    if (data.properties) {
      for (const property of data.properties) {
        properties[property.key] = property.value
      }
    }

    trackEvent(data.name as UnityEvent, { context: properties.context || 'unity-event', ...properties })
  }

  public TriggerExpression(data: { id: string; timestamp: number }) {
    allScenesEvent({
      eventType: 'playerExpression',
      payload: {
        expressionId: data.id
      }
    })

    const messageId = uuid()
    const body = `␐${data.id} ${data.timestamp}`

    sendPublicChatMessage(messageId, body)
  }

  public TermsOfServiceResponse(data: { sceneId: string; accepted: boolean; dontShowAgain: boolean }) {
    trackEvent('TermsOfServiceResponse', data)
  }

  public MotdConfirmClicked() {
    if (!hasWallet()) {
      globalObservable.emit('openUrl', { url: 'https://docs.decentraland.org/get-a-wallet/' })
    }
  }

  public GoTo(data: { x: number; y: number }) {
    notifyStatusThroughChat(`Jumped to ${data.x},${data.y}!`)
    TeleportController.goTo(data.x, data.y)
  }

  public GoToMagic() {
    TeleportController.goToCrowd().catch((e) => defaultLogger.error('error goToCrowd', e))
  }

  public GoToCrowd() {
    TeleportController.goToCrowd().catch((e) => defaultLogger.error('error goToCrowd', e))
  }

  public LogOut() {
    store.dispatch(logout())
  }

  public RedirectToSignUp() {
    store.dispatch(redirectToSignUp())
  }

  public SaveUserInterests(interests: string[]) {
    if (!interests) {
      return
    }
    const unique = new Set<string>(interests)

    store.dispatch(saveProfileDelta({ interests: Array.from(unique) }))
  }

  public SaveUserAvatar(changes: RendererSaveProfile) {
    if (validateRendererSaveProfile(changes)) {
      const update: Partial<Avatar> = {
        avatar: {
          bodyShape: changes.avatar.bodyShape,
          eyes: { color: changes.avatar.eyeColor },
          hair: { color: changes.avatar.hairColor },
          skin: { color: changes.avatar.skinColor },
          wearables: changes.avatar.wearables,
          snapshots: {
            body: changes.body,
            face256: changes.face256
          }
        }
      }
      store.dispatch(saveProfileDelta(update))
    } else {
      trackEvent('invalid_schema', { schema: 'SaveUserAvatar', payload: changes })
      defaultLogger.error(
        'Unity sent invalid profile' +
          JSON.stringify(changes) +
          ' Errors: ' +
          JSON.stringify(validateRendererSaveProfile.errors)
      )
    }
  }

  public SendPassport(passport: { name: string; email: string }) {
    store.dispatch(saveProfileDelta({ name: passport.name }))
    store.dispatch(signUp(passport.email))
  }

  public RequestOwnProfileUpdate() {
    const userId = getCurrentUserId(store.getState())
    const isGuest = getIsGuestLogin(store.getState())
    if (!isGuest && userId) {
      store.dispatch(profileRequest(userId))
    }
  }

  public SaveUserUnverifiedName(changes: { newUnverifiedName: string }) {
    store.dispatch(saveProfileDelta({ name: changes.newUnverifiedName, hasClaimedName: false }))
  }

  public SaveUserDescription(changes: { description: string }) {
    store.dispatch(saveProfileDelta({ description: changes.description }))
  }

  public GetFriends(getFriendsRequest: GetFriendsPayload) {
    getFriends(getFriendsRequest)
  }

  public CloseUserAvatar(isSignUpFlow = false) {
    if (isSignUpFlow) {
      getUnityInstance().DeactivateRendering()
      store.dispatch(signUpCancel())
    }
  }

  public SaveUserTutorialStep(data: { tutorialStep: number }) {
    store.dispatch(saveProfileDelta({ tutorialStep: data.tutorialStep }))
  }

  public ControlEvent({ eventType, payload }: { eventType: string; payload: any }) {
    switch (eventType) {
      case 'SceneReady': {
        const { sceneId } = payload
        sceneLifeCycleObservable.notifyObservers({ sceneId, status: 'ready' })
        break
      }
      case 'DeactivateRenderingACK': {
        /**
         * This event is called everytime the renderer deactivates its camera
         */
        store.dispatch(renderingDectivated())
        renderStateObservable.notifyObservers()
        break
      }
      case 'ActivateRenderingACK': {
        /**
         * This event is called everytime the renderer activates the main camera
         */
        store.dispatch(renderingActivated())
        renderStateObservable.notifyObservers()
        break
      }
      case 'StartStatefulMode': {
        const { sceneId } = payload
        const worker = getSceneWorkerBySceneID(sceneId)!
        const parcelScene = worker.getParcelScene()
        stopParcelSceneWorker(worker)
        const data = parcelScene.data.data as LoadableParcelScene
        getUnityInstance().LoadParcelScenes([data]) // Maybe unity should do it by itself?

        const options: StatefulWorkerOptions = {
          isEmpty: false
        }

        async function asyncLoad() {
          const { StatefulWorker } = await import('shared/world/StatefulWorker')
          setNewParcelScene(sceneId, new StatefulWorker(parcelScene, options))
        }

        asyncLoad().catch(defaultLogger.error)
        break
      }
      case 'StopStatefulMode': {
        const { sceneId } = payload
        reloadScene(sceneId).catch((error) => defaultLogger.warn(`Failed to stop stateful mode`, error))
        break
      }
      default: {
        defaultLogger.warn(`Unknown event type ${eventType}, ignoring`)
        break
      }
    }
  }

  public SendScreenshot(data: { id: string; encodedTexture: string }) {
    futures[data.id].resolve(data.encodedTexture)
  }

  public ReportBuilderCameraTarget(data: { id: string; cameraTarget: EcsMathReadOnlyVector3 }) {
    futures[data.id].resolve(data.cameraTarget)
  }

  public UserAcceptedCollectibles(_data: { id: string }) {
    // Here, we should have "airdropObservable.notifyObservers(data.id)".
    // It's disabled because of security reasons.
  }

  public SetDelightedSurveyEnabled(data: { enabled: boolean }) {
    setDelightedSurveyEnabled(data.enabled)
  }

  public SetScenesLoadRadius(data: { newRadius: number }) {
    parcelLimits.visibleRadius = Math.round(data.newRadius)

    renderDistanceObservable.notifyObservers({
      distanceInParcels: parcelLimits.visibleRadius
    })
  }

  public ReportScene(sceneId: string) {
    this.OpenWebURL({ url: `https://decentralandofficial.typeform.com/to/KzaUxh?sceneId=${sceneId}` })
  }

  public ReportPlayer(username: string) {
    this.OpenWebURL({ url: `https://decentralandofficial.typeform.com/to/owLkla?username=${username}` })
  }

  public BlockPlayer(data: { userId: string }) {
    store.dispatch(blockPlayers([data.userId]))
  }

  public UnblockPlayer(data: { userId: string }) {
    store.dispatch(unblockPlayers([data.userId]))
  }

  public RequestScenesInfoInArea(data: { parcel: { x: number; y: number }; scenesAround: number }) {
    store.dispatch(reportScenesAroundParcel(data.parcel, data.scenesAround))
  }

  public SetAudioStream(data: { url: string; play: boolean; volume: number }) {
    setAudioStream(data.url, data.play, data.volume).catch((err) => defaultLogger.log(err))
  }

  public SendChatMessage(data: { message: ChatMessage }) {
    store.dispatch(sendMessage(data.message))
  }

  public SetVoiceChatRecording(recordingMessage: { recording: boolean }) {
    store.dispatch(setVoiceChatRecording(recordingMessage.recording))
  }

  public ToggleVoiceChatRecording() {
    store.dispatch(toggleVoiceChatRecording())
  }

  public ApplySettings(settingsMessage: { voiceChatVolume: number; voiceChatAllowCategory: number }) {
    store.dispatch(setVoiceVolume(settingsMessage.voiceChatVolume))
    store.dispatch(setVoicePolicy(settingsMessage.voiceChatAllowCategory))
  }

  public async UpdateFriendshipStatus(message: FriendshipUpdateStatusMessage) {
    let { userId } = message
    let found = false
    const state = store.getState()

    // TODO - fix this hack: search should come from another message and method should only exec correct updates (userId, action) - moliva - 01/05/2020
    if (message.action === FriendshipAction.REQUESTED_TO) {
      const avatar = await ensureFriendProfile(userId)

      if (isAddress(userId)) {
        found = avatar.hasConnectedWeb3 || false
      } else {
        const profileByName = findProfileByName(state, userId)
        if (profileByName) {
          userId = profileByName.userId
          found = true
        }
      }
    }

    if (!found) {
      // if user profile was not found on server -> no connected web3, check if it's a claimed name
      const net = getSelectedNetwork(state)
      const address = await fetchENSOwner(ethereumConfigurations[net].names, userId)
      if (address) {
        // if an address was found for the name -> set as user id & add that instead
        userId = address
        found = true
      }
    }

    if (message.action === FriendshipAction.REQUESTED_TO && !found) {
      // if we still haven't the user by now (meaning the user has never logged and doesn't have a profile in the dao, or the user id is for a non wallet user or name is not correct) -> fail
      getUnityInstance().FriendNotFound(userId)
      return
    }

    store.dispatch(updateUserData(userId.toLowerCase(), toSocialId(userId)))
    store.dispatch(updateFriendship(message.action, userId.toLowerCase(), false))
  }

  public SearchENSOwner(data: { name: string; maxResults?: number }) {
    const profilesPromise = fetchENSOwnerProfile(data.name, data.maxResults)

    profilesPromise
      .then((profiles) => {
        getUnityInstance().SetENSOwnerQueryResult(data.name, profiles)
      })
      .catch((error) => {
        getUnityInstance().SetENSOwnerQueryResult(data.name, undefined)
        defaultLogger.error(error)
      })
  }

  public async JumpIn(data: WorldPosition) {
    const {
      gridPosition: { x, y },
      realm: { serverName }
    } = data

    notifyStatusThroughChat(`Jumping to ${serverName} at ${x},${y}...`)

    changeRealm(serverName).then(
      () => {
        const successMessage = `Jumped to ${x},${y} in realm ${serverName}!`
        notifyStatusThroughChat(successMessage)
        getUnityInstance().ConnectionToRealmSuccess(data)
        TeleportController.goTo(x, y, successMessage)
      },
      (e) => {
        const cause = e === 'realm-full' ? ' The requested realm is full.' : ''
        notifyStatusThroughChat('changerealm: Could not join realm.' + cause)
        getUnityInstance().ConnectionToRealmFailed(data)
        defaultLogger.error(e)
      }
    )
  }

  public ScenesLoadingFeedback(data: { message: string; loadPercentage: number }) {
    const { message, loadPercentage } = data
    store.dispatch(updateStatusMessage(message, loadPercentage))
  }

  public FetchHotScenes() {
    if (WORLD_EXPLORER) {
      reportHotScenes().catch((e: any) => {
        return defaultLogger.error('FetchHotScenes error', e)
      })
    }
  }

  public SetBaseResolution(data: { baseResolution: number }) {
    getUnityInstance().SetTargetHeight(data.baseResolution)
  }

  async RequestGIFProcessor(data: { imageSource: string; id: string; isWebGL1: boolean }) {
    if (!globalThis.gifProcessor) {
      globalThis.gifProcessor = new GIFProcessor(getUnityInstance().gameInstance, getUnityInstance(), data.isWebGL1)
    }

    globalThis.gifProcessor.ProcessGIF(data)
  }

  public DeleteGIF(data: { value: string }) {
    if (globalThis.gifProcessor) {
      globalThis.gifProcessor.DeleteGIF(data.value)
    }
  }

  public Web3UseResponse(data: { id: string; result: boolean }) {
    if (data.result) {
      futures[data.id].resolve(true)
    } else {
      futures[data.id].reject(new Error('Web3 operation rejected'))
    }
  }

  public FetchBalanceOfMANA() {
    const fn = async () => {
      const identity = getIdentity()

      if (!identity?.hasConnectedWeb3) {
        return
      }
      const net = getSelectedNetwork(store.getState())
      const balance = (await getERC20Balance(identity.address, ethereumConfigurations[net].MANAToken)).toNumber()
      if (this.lastBalanceOfMana !== balance) {
        this.lastBalanceOfMana = balance
        getUnityInstance().UpdateBalanceOfMANA(`${balance}`)
      }
    }

    fn().catch((err) => defaultLogger.error(err))
  }

  public SetMuteUsers(data: { usersId: string[]; mute: boolean }) {
    if (data.mute) {
      store.dispatch(mutePlayers(data.usersId))
    } else {
      store.dispatch(unmutePlayers(data.usersId))
    }
  }

  public async KillPortableExperience(data: { portableExperienceId: string }): Promise<void> {
    store.dispatch(removeScenePortableExperience(data.portableExperienceId))
  }

  public async SetDisabledPortableExperiences(data: { idsToDisable: string[] }): Promise<void> {
    store.dispatch(denyPortableExperiences(data.idsToDisable))
  }

  // Note: This message is deprecated and should be deleted in the future.
  //       We are maintaining it for backward compatibility we can safely delete if we are further than 2/03/2022
  public RequestBIWCatalogHeader() {
    const identity = getCurrentIdentity(store.getState())
    if (!identity) {
      const emptyHeader: Record<string, string> = {}
      getUnityInstance().SendBuilderCatalogHeaders(emptyHeader)
    } else {
      const headers = BuilderServerAPIManager.authorize(identity, 'get', '/assetpacks')
      getUnityInstance().SendBuilderCatalogHeaders(headers)
    }
  }

  // Note: This message is deprecated and should be deleted in the future.
  //       We are maintaining it for compatibility we can safely delete if we are further than 2/03/2022
  public RequestHeaderForUrl(data: { method: string; url: string }) {
    const identity = getCurrentIdentity(store.getState())

    const headers: Record<string, string> = identity
      ? BuilderServerAPIManager.authorize(identity, data.method, data.url)
      : {}
    getUnityInstance().SendBuilderCatalogHeaders(headers)
  }

  // Note: This message is deprecated and should be deleted in the future.
  //       It is here until the Builder API is stabilized and uses the same signedFetch method as the rest of the platform
  public RequestSignedHeaderForBuilder(data: { method: string; url: string }) {
    const identity = getCurrentIdentity(store.getState())

    const headers: Record<string, string> = identity
      ? BuilderServerAPIManager.authorize(identity, data.method, data.url)
      : {}
    getUnityInstance().SendHeaders(data.url, headers)
  }

  // Note: This message is deprecated and should be deleted in the future.
  //       It is here until the Builder API is stabilized and uses the same signedFetch method as the rest of the platform
  public RequestSignedHeader(data: { method: string; url: string; metadata: Record<string, any> }) {
    const identity = getCurrentIdentity(store.getState())

    const headers: Record<string, string> = identity
      ? getAuthHeaders(data.method, data.url, data.metadata, (_payload) =>
          Authenticator.signPayload(identity, data.url)
        )
      : {}

    getUnityInstance().SendHeaders(data.url, headers)
  }

  public async PublishSceneState(data: PublishPayload) {
    let deploymentResult: DeploymentResult

    deployScene(data)
      .then(() => {
        deploymentResult = { ok: true }
        if (data.reloadSingleScene) {
          const promise = invalidateScenesAtCoords(data.pointers)
          promise.catch((error) =>
            defaultLogger.error(`error reloading the scene by coords: ${data.pointers} ${error}`)
          )
        } else {
          const promise = invalidateScenesAtCoords(data.pointers, false)
          promise?.catch((error) => defaultLogger.error(`error invalidating all the scenes: ${error}`))
        }
        getUnityInstance().SendPublishSceneResult(deploymentResult)
      })
      .catch((error) => {
        deploymentResult = { ok: false, error: `${error}` }
        getUnityInstance().SendPublishSceneResult(deploymentResult)
        defaultLogger.error(error)
      })
  }

  public RequestWearables(data: {
    filters: {
      ownedByUser: string | null
      wearableIds?: string[] | null
      collectionIds?: string[] | null
      thirdPartyId?: string | null
    }
    context?: string
  }) {
    const { filters, context } = data
    const newFilters: WearablesRequestFilters = {
      ownedByUser: filters.ownedByUser ?? undefined,
      thirdPartyId: filters.thirdPartyId ?? undefined,
      wearableIds: arrayCleanup(filters.wearableIds),
      collectionIds: arrayCleanup(filters.collectionIds)
    }
    store.dispatch(wearablesRequest(newFilters, context))
  }

  public RequestUserProfile(userIdPayload: { value: string }) {
    store.dispatch(profileRequest(userIdPayload.value, ProfileType.DEPLOYED))
  }

  public ReportAvatarFatalError() {
    // TODO(Brian): Add more parameters?
    ReportFatalErrorWithUnityPayload(new Error(AVATAR_LOADING_ERROR), ErrorContext.RENDERER_AVATARS)
    BringDownClientAndShowError(AVATAR_LOADING_ERROR)
  }

  public UnpublishScene(data: { coordinates: string }) {
    unpublishSceneByCoords(data.coordinates).catch((error) => defaultLogger.log(error))
  }

  public async NotifyStatusThroughChat(data: { value: string }) {
    notifyStatusThroughChat(data.value)
  }

  public VideoProgressEvent(videoEvent: {
    componentId: string
    sceneId: string
    videoTextureId: string
    status: number
    currentOffset: number
    videoLength: number
  }) {
    const scene = getSceneWorkerBySceneID(videoEvent.sceneId)
    if (scene) {
      scene.emit('videoEvent' as IEventNames, {
        componentId: videoEvent.componentId,
        videoClipId: videoEvent.videoTextureId,
        videoStatus: videoEvent.status,
        currentOffset: videoEvent.currentOffset,
        totalVideoLength: videoEvent.videoLength
      })
    } else {
      defaultLogger.error(`SceneEvent: Scene ${videoEvent.sceneId} not found`, videoEvent)
    }
  }

  public ReportAvatarState(data: AvatarRendererMessage) {
    setRendererAvatarState(data)
  }

  public ReportDecentralandTime(data: any) {
    setDecentralandTime(data)
  }

  public ReportLog(data: { type: string; message: string }) {
    const logger = getUnityInstance().logger
    switch (data.type) {
      case 'trace':
        logger.trace(data.message)
        break
      case 'info':
        logger.info(data.message)
        break
      case 'warn':
        logger.warn(data.message)
        break
      case 'error':
        logger.error(data.message)
        break
      default:
        logger.log(data.message)
        break
    }
  }
}

function arrayCleanup<T>(array: T[] | null | undefined): T[] | undefined {
  return !array || array.length === 0 ? undefined : array
}

export const browserInterface: BrowserInterface = new BrowserInterface()
