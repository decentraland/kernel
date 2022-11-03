/* TODO: Get from https://github.com/decentraland/rpc/blob/main/src/push-channel.ts
 * Maybe we can expose it on @dcl/rpc
 */

type LastResolver = (err?: any) => void

class Node<T> {
  next?: Node<T> = undefined
  constructor(public readonly value: T, public prev?: Node<T>) {}
}

export function linkedList<T>() {
  let head: Node<T> | undefined = undefined
  let tail: Node<T> | undefined = undefined

  function enqueue(value: T) {
    const node: Node<T> = new Node<T>(value, tail)

    if (tail) {
      tail.next = node
    }
    if (!head) {
      head = node
    }
    tail = node
  }

  function remove(node: Node<T>): void {
    if (!node.next) {
      tail = node.prev
    } else {
      const nextNode = node.next
      nextNode.prev = node.prev
    }
    if (!node.prev) {
      head = node.next
    } else {
      const prevNode = node.prev
      prevNode.next = node.next
    }
  }

  // removes the head node and updates the head
  function dequeue(): T | undefined {
    const ret = head
    if (ret) {
      remove(ret)

      // this is important to prevent leaks
      delete ret.next
      delete ret.prev
      const value = ret.value
      // help the GC
      delete (ret as any).value
      return value
    }
    return undefined
  }

  // signals if the list is empty
  function isEmpty(): boolean {
    return !head
  }

  return { enqueue, dequeue, isEmpty }
}

export function pushableChannel<T>(onIteratorClose: () => void) {
  let returnLock: (() => void) | null = null
  const queue = linkedList<{ value: T; resolve: LastResolver }>()
  let closed = false
  let error: Error | null = null

  function closeAllPending() {
    if (!queue.isEmpty()) {
      const err = error || new Error('Channel was closed before deliverying the message')
      while (!queue.isEmpty()) {
        const { resolve } = queue.dequeue()!
        if (resolve) resolve(err)
      }
    }
  }

  function releaseLockIfNeeded() {
    // signal that we have a value
    if (returnLock) {
      const originalReturnLock = returnLock
      returnLock = null
      originalReturnLock()
    }
  }

  function push(value: T, resolve: (err?: any) => void) {
    if (closed) {
      resolve(new Error('Channel is closed'))
      return
    }
    if (error) {
      resolve(error)
      return
    }
    // push the value to the queue
    queue.enqueue({ value, resolve })
    releaseLockIfNeeded()
  }

  function failAndClose(errorToThrow: Error) {
    error = errorToThrow
    close()
    closeAllPending()
  }

  function yieldNextResult(): IteratorResult<T> | void {
    if (error && queue.isEmpty()) {
      throw error
    }
    if (closed && queue.isEmpty()) {
      return { done: true, value: undefined }
    }
    if (!queue.isEmpty()) {
      const node = queue.dequeue()!
      if (node.resolve) node.resolve(error || undefined)
      return {
        done: false,
        value: node.value
      }
    }
  }

  function close() {
    if (!closed) {
      closed = true
      releaseLockIfNeeded()
      onIteratorClose()
    }
  }

  const iterable: AsyncGenerator<T> = {
    async next() {
      while (true) {
        try {
          const result = yieldNextResult()
          if (result) {
            return result
          } else {
            await new Promise<void>((res) => (returnLock = res))
          }
        } catch (err: any) {
          failAndClose(err)
          throw err
        }
      }
    },
    async return(value) {
      close()
      closeAllPending()
      return { done: true, value }
    },
    async throw(e) {
      if (error) {
        throw error
      }
      failAndClose(e)
      return { done: true, value: undefined }
    },
    [Symbol.asyncIterator]() {
      return iterable
    }
  }

  function isClosed() {
    return closed
  }

  return { iterable, push, close, failAndClose, isClosed, [Symbol.asyncIterator]: () => iterable }
}

export class AsyncQueue<T> implements AsyncGenerator<T> {
  // enqueues > dequeues
  values = linkedList<IteratorResult<T>>()
  // dequeues > enqueues
  settlers = linkedList<{
    resolve(x: IteratorResult<T>): void
    reject(error: Error): void
  }>()
  closed = false
  error: Error | undefined = undefined

  constructor(private requestingNext: (queue: AsyncQueue<T>, action: 'next' | 'close') => void) {}

  [Symbol.asyncIterator](): AsyncGenerator<T> {
    return this
  }

  enqueue(value: T) {
    if (this.closed) {
      throw new Error('Channel is closed')
    }
    if (!this.settlers.isEmpty()) {
      if (!this.values.isEmpty()) {
        throw new Error('Illegal internal state')
      }
      const settler = this.settlers.dequeue()!
      if (value instanceof Error) {
        settler.reject(value)
      } else {
        settler.resolve({ value })
      }
    } else {
      this.values.enqueue({ value })
    }
  }
  /**
   * @returns a Promise for an IteratorResult
   */
  async next(): Promise<IteratorResult<T>> {
    if (!this.values.isEmpty()) {
      const value = this.values.dequeue()!
      return value
    }
    if (this.error) {
      throw this.error
    }
    if (this.closed) {
      if (!this.settlers.isEmpty()) {
        throw new Error('Illegal internal state')
      }
      return { done: true, value: undefined }
    }
    // Wait for new values to be enqueued
    return new Promise<IteratorResult<T>>((resolve, reject) => {
      this.requestingNext(this, 'next')
      this.settlers.enqueue({ resolve, reject })
    })
  }

  async return(value: any): Promise<IteratorResult<T>> {
    this.close(value)
    return { done: true, value }
  }

  async throw(error: Error): Promise<IteratorResult<T>> {
    this.close(error)
    return { done: true, value: undefined }
  }

  close(error?: Error) {
    if (error)
      while (!this.settlers.isEmpty()) {
        this.settlers.dequeue()!.reject(error)
      }
    else
      while (!this.settlers.isEmpty()) {
        this.settlers.dequeue()!.resolve({ done: true, value: undefined })
      }
    if (error) this.error = error
    if (!this.closed) {
      this.closed = true
      this.requestingNext(this, 'close')
    }
  }
}
