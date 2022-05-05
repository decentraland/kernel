import { combineReducers } from 'redux'

import { profileReducer } from '../profiles/reducer'
import { catalogsReducer } from '../catalogs/reducer'
import { rendererReducer } from '../renderer/reducer'
import { loadingReducer } from '../loading/reducer'
import { atlasReducer } from '../atlas/reducer'
import { daoReducer } from '../dao/reducer'
import { metaReducer } from '../meta/reducer'
import { chatReducer } from '../chat/reducer'
import { commsReducer } from '../comms/reducer'
import { friendsReducer } from '../friends/reducer'
import { sessionReducer } from '../session/reducer'
import { questsReducer } from '../quests/reducer'
import { portableExperienceReducer } from '../portableExperiences/reducer'
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
  dao: daoReducer,
  comms: commsReducer,
  meta: metaReducer,
  quests: questsReducer,
  wearablesPortableExperiences: wearablesPortableExperienceReducer,
  portableExperiences: portableExperienceReducer
})
