import { combineReducers } from 'redux'
import { voiceReducer } from '@dcl/voice/dist/reducer'

import { profileReducer } from '../profiles/reducer'
import { catalogsReducer } from '../catalogs/reducer'
import { rendererReducer } from '../renderer/reducer'
import { protocolReducer } from '../protocol/reducer'
import { loadingReducer } from '../loading/reducer'
import { atlasReducer } from '../atlas/reducer'
import { daoReducer } from '../dao/reducer'
import { metaReducer } from '../meta/reducer'
import { chatReducer } from '../chat/reducer'
import { commsReducer } from '../comms/reducer'
import { friendsReducer } from '../friends/reducer'
import { sessionReducer } from '../session/reducer'
import { questsReducer } from '../quests/reducer'
import { wearablesPortableExperienceReducer } from '../wearablesPortableExperience/reducer'

export const reducers = combineReducers({
  atlas: atlasReducer,
  chat: chatReducer,
  friends: friendsReducer,
  session: sessionReducer,
  loading: loadingReducer,
  profiles: profileReducer,
  catalogs: catalogsReducer,
  renderer: rendererReducer,
  protocol: protocolReducer,
  dao: daoReducer,
  comms: commsReducer,
  meta: metaReducer,
  quests: questsReducer,
  wearablesPortableExperiences: wearablesPortableExperienceReducer,
  voice: voiceReducer
})
