import { RemoteStream } from 'ion-sdk-js'

type Cache = {
  streams: Record<string, { audio: HTMLAudioElement, node: MediaStreamAudioSourceNode } | undefined>
  audioContext: AudioContext | undefined
  gainNode: GainNode | undefined
}


const cache: Cache = {
  audioContext: undefined,
  gainNode: undefined,
  streams: {}
}

const getValue = <T extends keyof Cache>(
  key: T
): Cache[T] => cache[key]

const setValue = <T extends keyof Cache>(
  key: T,
  value: Cache[T]
): Cache[T] => cache[key] = value

const setValue2 = <
  T extends keyof Cache,
  K extends keyof Cache[T]
>(key: T, key2: K, value: Cache[T][K]) => (cache[key] as any)[key2] = value


const getContext = () => {
  const context = getValue('audioContext') || setValue('audioContext', new AudioContext())!
  const gainNode = getValue('gainNode')

  if (gainNode && context) {
    return { context, gainNode }
  }

  const newGainNode = setValue('gainNode', new GainNode(context))!
  newGainNode.connect(context.destination)

  return { context, gainNode: newGainNode }
}

export function removeVoiceStream(streamId: string) {
  const stream = getValue('streams')[streamId]

  if (!stream) {
    return
  }

  stream.audio.srcObject = null
  stream.audio.remove()
  stream.node.disconnect()

  setValue2('streams', streamId, undefined)
}

export function addVoiceStream(streams: RemoteStream[]) {
  const { context, gainNode } = getContext()
  const oldStreams = getValue('streams')

  streams.forEach((stream) => {
    const prevStream = oldStreams[stream.id]
    if (prevStream) return

    const streamNode = context.createMediaStreamSource(stream)
    streamNode.connect(gainNode)

    const audio = new Audio()
    audio.muted = true
    audio.srcObject = stream

    setValue2('streams', stream.id, { audio, node: streamNode })
  })
}
