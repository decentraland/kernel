import * as sinon from 'sinon'
import { Vector3 } from '@dcl/ecs-math'
import { getUnityInstance } from '../../packages/unity-interface/IUnityInterface'
import defaultLogger from '../../packages/shared/logger'
import { RestrictedActions } from '../../packages/shared/apis/RestrictedActions'
import { lastPlayerPosition } from '../../packages/shared/world/positionThings'
import { Permissions } from 'shared/apis/Permissions'
import { PermissionItem } from 'shared/apis/PermissionItems'

describe('RestrictedActions tests', () => {
  afterEach(() => sinon.restore())

  const options = {
    apiName: '',
    system: null,
    expose: sinon.stub(),
    notify: sinon.stub(),
    on: sinon.stub(),
    getAPIInstance(name): any {}
  }

  describe('TriggerEmote tests', () => {
    const emote = 'emote'

    it('should trigger emote', async () => {
      mockLastPlayerPosition()
      mockPermissionsWith(PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE)
      sinon.mock(getUnityInstance()).expects('TriggerSelfUserExpression').once().withExactArgs(emote)

      const module = new RestrictedActions(options)
      module.permissions = new Permissions(options)
      await module.triggerEmote({ predefined: emote })
      sinon.verify()
    })

    it('should fail when scene does not have permissions', async () => {
      mockLastPlayerPosition()
      mockPermissionsWith()
      sinon.mock(getUnityInstance()).expects('TriggerSelfUserExpression').never()

      const module = new RestrictedActions(options)
      module.permissions = new Permissions(options)
      try{
        await module.triggerEmote({ predefined: 'emote' })
      }catch(err){

      }
      sinon.stub(module, 'assertHasPermissions').threw()
      sinon.verify()
    })

    it('should fail when player is out of scene and try to move', async () => {
      mockLastPlayerPosition(false)
      mockPermissionsWith(PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE)

      sinon.mock(getUnityInstance()).expects('TriggerSelfUserExpression').never()

      sinon
        .mock(defaultLogger)
        .expects('error')
        .once()
        .withExactArgs('Error: Player is not inside of scene', lastPlayerPosition)

      const module = new RestrictedActions(options)
      module.permissions = new Permissions(options)
      await module.triggerEmote({ predefined: emote })
      sinon.verify()
    })
  })

  describe('MovePlayerTo tests', () => {
    it('should move the player', async () => {
      mockLastPlayerPosition()
      mockPermissionsWith(PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE)
      sinon
        .mock(getUnityInstance())
        .expects('Teleport')
        .once()
        .withExactArgs({ position: { x: 8, y: 0, z: 1624 }, cameraTarget: undefined }, false)

      const module = new RestrictedActions(options)
      module.permissions = new Permissions(options)

      await module.movePlayerTo(new Vector3(8, 0, 8))
      sinon.verify()
    })

    it('should fail when position is outside scene', async () => {
      mockLastPlayerPosition()
      mockPermissionsWith(PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE)
      sinon
        .mock(defaultLogger)
        .expects('error')
        .once()
        .withExactArgs('Error: Position is out of scene', { x: 21, y: 0, z: 1648 })

      sinon.mock(getUnityInstance()).expects('Teleport').never()

      const module = new RestrictedActions(options)
      module.permissions = new Permissions(options)

      await module.movePlayerTo(new Vector3(21, 0, 32))
      sinon.verify()
    })

    it('should fail when scene does not have permissions', async () => {
      mockLastPlayerPosition()
      mockPermissionsWith()
      sinon.mock(getUnityInstance()).expects('Teleport').never()

      const module = new RestrictedActions(options)
      module.permissions = new Permissions(options)

      try{
        await module.movePlayerTo(new Vector3(8, 0, 8))
      }catch(err){

      }

      sinon.stub(module, 'assertHasPermissions').threw()
      sinon.verify()
    })

    it('should fail when player is out of scene and try to move', async () => {
      mockLastPlayerPosition(false)
      mockPermissionsWith(PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE)

      sinon.mock(getUnityInstance()).expects('Teleport').never()

      sinon
        .mock(defaultLogger)
        .expects('error')
        .once()
        .withExactArgs('Error: Player is not inside of scene', lastPlayerPosition)

      const module = new RestrictedActions(options)
      module.permissions = new Permissions(options)

      await module.movePlayerTo(new Vector3(8, 0, 8))
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

  function mockPermissionsWith(...permissions: PermissionItem[]) {
    sinon.mock(options).expects('getAPIInstance').withArgs().atLeast(1).returns(buildParcelIdentity(permissions))
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
          requiredPermissions: permissions,
          spawnPoints: [
            { name: 'spawn1', default: true, position: { x: 0, y: 0, z: 0 }, cameraTarget: { x: 8, y: 1, z: 8 } }
          ]
        }
      }
    }
  }
})
