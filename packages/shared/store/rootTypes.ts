import { Store } from 'redux'

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
import { RootVoiceState } from '../voice/types'
import { RootQuestsState } from 'shared/quests/types'
import { RootWearablesPortableExperienceState } from 'shared/wearablesPortableExperience/types'

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
