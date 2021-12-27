# Isolated scenes

## Description

Isolated scenes is a mode of kernel in which there is no dynamic loading of scenes based on the user position. It can be leveraged by tools like Builder to shut down the neighbouring scenes and can be used directly from scene.

## Use cases

- Once active the dynamic loading of scenes should be halted, and recovered once we finish the isolated scene mode.
- Isolated scenes can be started from builder in world, either from deployed scenes and from non-deployed scenes (without sceneId and using a manifest)
- Isolated scenes can be started from scenes directly, to shut down the neighbouring scene loading. Useful in dungeons, closed buildings, etc.

## Implemented methods or messages

```typescript

type IsolatedSceneMode
  = ManifestIsolatedScene
  | DeployedIsolatedScene

type ManifestIsolatedScene = {
  manifest: SceneStateDefinition
}

async function startIsolatedMode(options: IsolatedSceneMode) { ... }
async function exitIsolatedMode() { ... }

```

### Staged plan

1. Implement new messages to start/end isolated mode. Using stateful worker
2. Implement new CRDT protocol for stateful scenes

## Current status

```sequence

participant Unity as R
participant Kernel as K
participant Scene worker as W

note over R: Builder initialization mode
R->K: enter stateful mode(sceneId)
K-->K: Kill previous worker
K->R: UnloadScene(sceneId)
K-->W: Create stateful worker
K->R: LoadParcelScenes(sceneId)
W->R: Send entities and components

note over R: Builder mode\n(stateful scene protocol)
R-->W: add/remove components
R-->W: publish/save
```

## New development

```sequence

participant Unity as R
participant Kernel as K
participant Scene worker as W


R->R: Download manifest, \ncreate and load\nbuilder scene

note over R: Must tell the kernel to load the worker
R->K: startIsolatedMode(Array<{ sceneId, parcels }>)
K->K: shutdown scenes\ncreate worker
K->R: Unload all scenes
K->W: createSceneWorker(newSceneId)
W->K: CREATION_SUCCEEDED(newSceneId)
K->R: LoadParcelScenes(newSceneId)

note over R: Here it starts the custom\nlogic for builder
R-->W: ClearEntities() SendState(AllUnityEntities)
W-->R:

note over R: Play/Pause behavior
R-->W: Signal worker to stop or resume game loop

note over R: Restore initial state
R->R: ResetButton()
R-->W: ClearEntities() SendState(AllUnityEntities)

note over R: Save project
R->R: SaveProjectButton()
R->R: StoreStateInServer(AllUnityEntities)

note over R: End builder mode
R->K: endIsolatedMode()
K->K: restart scene loader
K->R: LoadParcelScenes(sceneId)
K->R:
```

```typescript

function startIsolatedMode() {...}

function startBuilder() {


    // create a future to hold the scene
    const sceneManagerFuture = promise()

    const tmpSceneId = newRandomId()
    sceneLoading.onNewScene += (scene) => {
        if(scene.id == tmpSceneId)
            sceneManagerFuture.resolve(scene)
    }

    // signal the kernel
    await startIsolatedMode(tmpSceneId)

    // wait for scene created
    const createdSceneManager = await sceneManagerFuture

    // send manifest to the worker scene

}
```
