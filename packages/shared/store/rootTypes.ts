import { Store } from 'redux'
import { RootVoiceState } from '@dcl/voice/dist/types'

import { RootAtlasState } from '../atlas/types'
import { RootProfileState } from '../profiles/types'
import { RootDaoState } from '../dao/types'
import { RootMetaState } from '../meta/types'
import { RootChatState } from '../chat/types'
import { RootCommsState } from '../comms/types'
import { RootSessionState } from '../session/types'
import { RootFriendsState } from '../friends/types'
import { RootRendererState } from '../renderer/types'
import { RootCatalogState } from '../catalogs/types'
import { RootLoadingState } from '../loading/reducer'
import { RootQuestsState } from '../quests/types'
import { RootWearablesPortableExperienceState } from '../wearablesPortableExperience/types'

export type RootState = RootAtlasState &
  RootProfileState &
  RootDaoState &
  RootMetaState &
  RootChatState &
  RootCommsState &
  RootSessionState &
  RootFriendsState &
  RootRendererState &
  RootLoadingState &
  RootCatalogState &
  RootQuestsState &
  RootWearablesPortableExperienceState &
  RootVoiceState

export type RootStore = Store<RootState>
