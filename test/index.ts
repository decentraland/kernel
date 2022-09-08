globalThis['isRunningTests'] = true

/**
 * Hello, this file is the tests entry point.
 * You should import all your tests here.
 */

beforeEach(() => history.replaceState({}, '', `?`))

/* HELPERS */
import './atomicHelpers/parcelScenePositions.test'
import './atomicHelpers/landHelpers.test'
import './atomicHelpers/vectorHelpers.test'
import './atomicHelpers/OrderedRingBuffer.test'
import './atomicHelpers/SortedLimitedQueue.test'

/* UNIT */
import './unit/ethereum.test'
import './unit/objectComparison.test'
import './unit/jsonFetch.test'
import './unit/profiles.saga.test'
import './unit/getPerformanceInfo.test'
import './unit/positionThings.test'
import './unit/RestrictedActions.test'
import './unit/engine.test'
import './unit/catalog.saga.test'
import './unit/portable-experiences.test'
import './unit/logger.spec'
import './unit/comms-resolver.test'
import './unit/friends.saga.test'
import './unit/channels.saga.test'

/* SCENE EVENTS */
import './sceneEvents/visibleAvatars.spec'
import './sceneEvents/comms.spec'

import './dao'

import './scene-system/websocketWrapper.spec'
import './scene-system/fetchWrapper.spec'

declare var mocha: Mocha
declare var globalThis: any

mocha.run()
