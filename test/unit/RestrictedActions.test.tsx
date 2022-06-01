import * as sinon from 'sinon'
import { getUnityInstance } from '../../packages/unity-interface/IUnityInterface'
import defaultLogger from '../../packages/shared/logger'
import { lastPlayerPosition } from '../../packages/shared/world/positionThings'
import { PermissionItem, permissionItemToJSON } from 'shared/apis/gen/Permissions'
import { realMovePlayerTo, realTriggerEmote } from 'shared/apis/host/RestrictedActions'
import { PortContext } from 'shared/apis/host/context'
import { assertHasPermission } from 'shared/apis/host/Permissions'
import { Vector3 } from '@dcl/legacy-ecs'

describe('RestrictedActions tests', () => {
  afterEach(() => sinon.restore())
  sinon.mock()

  describe('TriggerEmote tests', () => {
    const emote = 'emote'

    it('should trigger emote', async () => {
      mockLastPlayerPosition()
      const ctx = getContextWithPermissions(PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE)
      sinon.mock(getUnityInstance()).expects('TriggerSelfUserExpression').once().withExactArgs(emote)

      await realTriggerEmote({ predefinedEmote: emote }, ctx)
      sinon.verify()
    })

    it('should fail when scene does not have permissions', async () => {
      mockLastPlayerPosition()
      const ctx = getContextWithPermissions()
      sinon.mock(getUnityInstance()).expects('TriggerSelfUserExpression').never()

      try {
        await realTriggerEmote({ predefinedEmote: 'emote' }, ctx)
      } catch (err) {

      }
      sinon.spy(assertHasPermission).threw()
      sinon.verify()
    })

    it('should fail when player is out of scene and try to move', async () => {
      mockLastPlayerPosition(false)
      const ctx = getContextWithPermissions(PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE)

      sinon.mock(getUnityInstance()).expects('TriggerSelfUserExpression').never()

      sinon
        .mock(defaultLogger)
        .expects('error')
        .once()
        .withExactArgs('Error: Player is not inside of scene', lastPlayerPosition)

      await realTriggerEmote({ predefinedEmote: 'emote' }, ctx)
      sinon.verify()
    })
  })

  describe('MovePlayerTo tests', () => {
    it('should move the player', async () => {
      mockLastPlayerPosition()
      const ctx = getContextWithPermissions(PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE)
      sinon
        .mock(getUnityInstance())
        .expects('Teleport')
        .once()
        .withExactArgs({ position: { x: 8, y: 0, z: 1624 }, cameraTarget: undefined }, false)

      await realMovePlayerTo({ newRelativePosition: new Vector3(8, 0, 8) }, ctx)

      sinon.verify()
    })

    it('should fail when position is outside scene', async () => {
      mockLastPlayerPosition()
      const ctx = getContextWithPermissions(PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE)
      sinon
        .mock(defaultLogger)
        .expects('error')
        .once()
        .withExactArgs('Error: Position is out of scene', { x: 21, y: 0, z: 1648 })

      sinon.mock(getUnityInstance()).expects('Teleport').never()
      await realMovePlayerTo({ newRelativePosition: new Vector3(21, 0, 32) }, ctx)
      sinon.verify()
    })

    it('should fail when scene does not have permissions', async () => {
      mockLastPlayerPosition()
      const ctx = getContextWithPermissions()
      sinon.mock(getUnityInstance()).expects('Teleport').never()

      try {
        await realMovePlayerTo({ newRelativePosition: new Vector3(8, 0, 8) }, ctx)
      } catch (err) {

      }

      sinon.spy(assertHasPermission).threw()
      sinon.verify()
    })

    it('should fail when player is out of scene and try to move', async () => {
      mockLastPlayerPosition(false)
      const ctx = getContextWithPermissions(PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE)

      sinon.mock(getUnityInstance()).expects('Teleport').never()

      sinon
        .mock(defaultLogger)
        .expects('error')
        .once()
        .withExactArgs('Error: Player is not inside of scene', lastPlayerPosition)

      await realMovePlayerTo({ newRelativePosition: new Vector3(8, 0, 8) }, ctx)

      sinon.verify()
    })
  })

  const mockLastPlayerPosition = (inside: boolean = true) => {
    const position = inside
      ? { x: 7.554769515991211, y: 1.7549998760223389, z: 1622.2711181640625 } // in
      : { x: -1.0775706768035889, y: 1.774094820022583, z: 1621.8487548828125 } // out
    sinon.stub(lastPlayerPosition, 'x').value(position.x)
    sinon.stub(lastPlayerPosition, 'y').value(position.y)
    sinon.stub(lastPlayerPosition, 'z').value(position.z)
  }

  function getContextWithPermissions(...permissions: PermissionItem[]): PortContext {
    const parcelIdentity = buildParcelIdentity(permissions)
    return {
      Permissions: {
        permissionGranted: permissions
      },
      ParcelIdentity: {
        ...parcelIdentity,
        cid: 'test',
        isPortableExperience: false,
        isEmpty: false
      },
      DevTools: {
        logger: defaultLogger
      }
    } as any
  }

  function buildParcelIdentity(permissions: PermissionItem[] = []) {
    return {
      land: {
        sceneJsonData: {
          display: { title: 'interactive-text', favicon: 'favicon_asset' },
          contact: { name: 'Ezequiel', email: 'ezequiel@decentraland.org' },
          owner: 'decentraland',
          scene: { parcels: ['0,101'], base: '0,101' },
          communications: { type: 'webrtc', signalling: 'https://signalling-01.decentraland.org' },
          policy: { contentRating: 'E', fly: true, voiceEnabled: true, blacklist: [] },
          main: 'game.js',
          tags: [],
          requiredPermissions: permissions.map(item => permissionItemToJSON(item)),
          spawnPoints: [
            { name: 'spawn1', default: true, position: { x: 0, y: 0, z: 0 }, cameraTarget: { x: 8, y: 1, z: 8 } }
          ]
        }
      }
    }
  }
})
