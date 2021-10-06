import { select, call, put } from 'redux-saga/effects'

import { getCommsIsland } from '../../comms/selectors'
import { getClient } from '../selectors'
import { getCurrentUserId } from '../../session/selectors'
import { startLocalStream } from '../actions'

export function* joinRoom() {
  const islandRoom: string = yield select(getCommsIsland)
  const client: ReturnType<typeof getClient> = yield select(getClient)
  const userId: string = yield select(getCurrentUserId)

  if (!client || !islandRoom || !userId) return

  client.leave()
  // TODO ok, this is not working. Leave doesn't leave at all
  // And joining a new room throws an error
  try {
    yield call(() => client.join(islandRoom, userId))
    yield put(startLocalStream())
  } catch (e) {
    // tslint:disable-next-line: no-console
    console.log('Join Room error: ', e)
    client.close()
  }
}
