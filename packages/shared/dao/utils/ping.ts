import defaultLogger from '../../logger'
import { PingResult, ServerConnectionStatus } from '../types'

export async function ping(url: string, timeoutMs: number = 5000): Promise<PingResult> {
  try {
    return await new Promise<PingResult>((resolve) => {
      const http = new XMLHttpRequest()

      let started: Date

      http.timeout = timeoutMs

      http.onreadystatechange = () => {
        if (http.readyState === XMLHttpRequest.OPENED) {
          started = new Date()
        }
        if (http.readyState === XMLHttpRequest.DONE) {
          try {
            const ended = new Date().getTime()
            if (http.status !== 200) {
              resolve({
                status: ServerConnectionStatus.UNREACHABLE
              })
            } else {
              resolve({
                status: ServerConnectionStatus.OK,
                elapsed: ended - started.getTime(),
                result: JSON.parse(http.responseText)
              })
            }
          } catch (e) {
            defaultLogger.error('Error fetching status of Catalyst server', e)
            resolve({})
          }
        }
      }

      http.open('GET', url, true)

      try {
        http.send(null)
      } catch (exception) {
        resolve({
          status: ServerConnectionStatus.UNREACHABLE
        })
      }
    })
  } catch {
    return {
      status: ServerConnectionStatus.UNREACHABLE
    }
  }
}
