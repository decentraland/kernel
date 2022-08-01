
;(globalThis as any).location = new URL("https://play.decentraland.org")


globalThis['isRunningTests'] = true
;(globalThis as any)['self'] = globalThis

/**
 * Hello, this file is the tests entry point.
 * You should import all your tests here.
 */

beforeEach(() => history.replaceState({}, '', `?`))


const mochax = require('mocha/mocha')

/* HELPERS */
require('./atomicHelpers/parcelScenePositions.test')
require('./atomicHelpers/landHelpers.test')
require('./atomicHelpers/vectorHelpers.test')
require('./atomicHelpers/OrderedRingBuffer.test')
require('./atomicHelpers/SortedLimitedQueue.test')

/* UNIT */
require('./unit/ethereum.test')
require('./unit/objectComparison.test')
require('./unit/jsonFetch.test')
require('./unit/profiles.saga.test')
require('./unit/getPerformanceInfo.test')
require('./unit/positionThings.test')
require('./unit/RestrictedActions.test')
require('./unit/engine.test')
require('./unit/catalog.saga.test')
require('./unit/portable-experiences.test')
require('./unit/logger.spec')
require('./unit/comms-resolver.test')

/* SCENE EVENTS */
require('./sceneEvents/visibleAvatars.spec')
require('./sceneEvents/comms.spec')

require('./dao')

require('./scene-system/websocketWrapper.spec')
require('./scene-system/fetchWrapper.spec')

mochax.setup('bdd')
mochax.run()
