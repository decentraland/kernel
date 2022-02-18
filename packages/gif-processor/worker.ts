import defaultLogger from 'shared/logger'
import { parseGIF, decompressFrames } from 'gifuct-js'
import { ProcessorMessage, WorkerMessageData } from './types'

declare const self: any

const gifCanvas = new OffscreenCanvas(1, 1)
const gifCanvasCtx = gifCanvas.getContext('2d')
const gifPatchCanvas = new OffscreenCanvas(1, 1)
const gifPatchCanvasCtx = gifPatchCanvas.getContext('2d')
const resizedCanvas = new OffscreenCanvas(1, 1)
const resizedCanvasCtx = gifCanvas.getContext('2d')
const maxGIFDimension = 512

let frameImageData: any = undefined

{
  const payloads: ProcessorMessage[] = []
  let payloadInProcess: ProcessorMessage | null = null
  let abortController: AbortController | null

  self.onmessage = (e: ProcessorMessage) => {
    if (e.data.type === 'FETCH') {
      EnqueuePayload(e)
    } else if (e.data.type === 'CANCEL') {
      CancelPayload(e)
    }
  }

  function EnqueuePayload(e: ProcessorMessage) {
    payloads.push(e)
    if (payloads.length === 1) {
      const promise = ConsumePayload()
      promise.catch((error) => defaultLogger.log(error))
    }
  }

  function CancelPayload(e: ProcessorMessage) {
    const isDownloading = abortController && payloadInProcess && payloadInProcess.data.id === e.data.id
    if (isDownloading) {
      abortController!.abort()
      return
    }

    for (let i = 0; i < payloads.length; i++) {
      if (payloads[i].data.id === e.data.id) {
        payloads.slice(i, 0)
        return
      }
    }
  }

  async function ConsumePayload() {
    while (payloads.length > 0) {
      payloadInProcess = payloads[0]
      await DownloadAndProcessGIF(payloadInProcess)
      payloadInProcess = null
      payloads.splice(0, 1)
    }
  }

  async function DownloadAndProcessGIF(e: ProcessorMessage) {
    abortController = new AbortController()
    const signal = abortController.signal

    try {
      const imageFetch = fetch(e.data.url, { signal })
      const response = await imageFetch
      abortController = null

      const buffer = await response.arrayBuffer()
      const parsedGif = await parseGIF(buffer)
      const decompressedFrames = decompressFrames(parsedGif, false)
      const frameDelays = []
      const framesAsArrayBuffer = []

      let hasToBeResized = false
      const hasTransparency = parsedGif.frames[0]?.gce?.extras?.transparentColorGiven

      frameImageData = undefined

      gifCanvas.width = decompressedFrames[0].dims.width
      let finalWidth = gifCanvas.width

      gifCanvas.height = decompressedFrames[0].dims.height
      let finalHeight = gifCanvas.height

      hasToBeResized = gifCanvas.width > maxGIFDimension || gifCanvas.height > maxGIFDimension
      if (hasToBeResized) {
        const scalingFactor =
          gifCanvas.width > gifCanvas.height ? gifCanvas.width / maxGIFDimension : gifCanvas.height / maxGIFDimension
        resizedCanvas.width = gifCanvas.width / scalingFactor
        finalWidth = resizedCanvas.width

        resizedCanvas.height = gifCanvas.height / scalingFactor
        finalHeight = resizedCanvas.height
      }

      for (const key in decompressedFrames) {
        frameDelays.push(decompressedFrames[key].delay)

        const processedImageData = GenerateFinalImageData(decompressedFrames[key], hasToBeResized, hasTransparency)
        if (processedImageData) framesAsArrayBuffer.push(processedImageData.data.buffer)
      }

      self.postMessage(
        {
          success: true,
          arrayBufferFrames: framesAsArrayBuffer,
          width: finalWidth,
          height: finalHeight,
          delays: frameDelays,
          url: e.data.url,
          id: e.data.id
        } as WorkerMessageData,
        framesAsArrayBuffer
      )
    } catch (err) {
      abortController = null
      self.postMessage({
        success: false,
        id: e.data.id
      } as Partial<WorkerMessageData>)
    }
  }

  function GenerateFinalImageData(
    frame: any,
    hasToBeResized: boolean,
    hasTransparency?: boolean
  ): ImageData | undefined {
    if (!frameImageData || frame.dims.width !== frameImageData.width || frame.dims.height !== frameImageData.height) {
      gifPatchCanvas.width = frame.dims.width
      gifPatchCanvas.height = frame.dims.height

      frameImageData = gifPatchCanvasCtx?.createImageData(frame.dims.width, frame.dims.height)
    }

    if (frameImageData) {
      const transparencyEnabled = hasTransparency ?? false
      frameImageData.data.set(generatePatch(frame, transparencyEnabled))
      gifPatchCanvasCtx?.putImageData(frameImageData, 0, 0)

      // We have to flip it vertically or it's rendered upside down
      gifCanvasCtx?.scale(1, -1)
      gifCanvasCtx?.drawImage(gifPatchCanvas, frame.dims.left, -(gifCanvas.height - frame.dims.top))
    }

    let finalImageData = gifCanvasCtx?.getImageData(0, 0, gifCanvas.width, gifCanvas.height)

    // Reset the canvas scale/transformation (otherwise the resizing breaks)
    gifCanvasCtx?.setTransform(1, 0, 0, 1, 0, 0)

    if (finalImageData && hasToBeResized) {
      resizedCanvasCtx?.drawImage(
        gifCanvas,
        0,
        0,
        gifCanvas.width,
        gifCanvas.height,
        0,
        0,
        resizedCanvas.width,
        resizedCanvas.height
      )

      finalImageData = resizedCanvasCtx?.getImageData(0, 0, resizedCanvas.width, resizedCanvas.height)
    }

    return finalImageData
  }
}

const generatePatch = (image: any, withTransparency: boolean) => {
  const totalPixels = image.pixels.length
  const patchData = new Uint8ClampedArray(totalPixels * 4)
  for (let i = 0; i < totalPixels; i++) {
    const pos = i * 4
    const colorIndex = image.pixels[i]
    const color = image.colorTable[colorIndex] || [0, 0, 0]
    patchData[pos] = color[0]
    patchData[pos + 1] = color[1]
    patchData[pos + 2] = color[2]
    patchData[pos + 3] = withTransparency ? (colorIndex !== image.transparentIndex ? 255 : 0) : 255
  }

  return patchData
}
