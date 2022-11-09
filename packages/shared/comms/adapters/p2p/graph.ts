import { Edge } from '@dcl/protocol/out-ts/decentraland/kernel/comms/v3/p2p.gen'

// TODO metrica por cada metodo + metrica por cada vez que se genera el árbol
export type Graph = {
  addConnection: (p1: string, p2: string) => void
  removeConnection: (p1: string, p2: string) => void
  removePeer: (p: string) => void
  getMST: () => Edge[]
  getReachablePeers: () => Set<string>

  asDot: () => string
  asMatrixString: () => string
}

export function createConnectionsGraph(peerId: string, maxPeers: number = 100): Graph {
  const peers: string[] = [peerId]
  const matrix = new Uint8Array(maxPeers * maxPeers)
  matrix.fill(0)

  let mst: Edge[] = []
  let dirty = true
  const reachablePeers = new Set<string>()

  function getMST() {
    if (dirty) {
      calculate()
      dirty = false
    }
    return mst
  }

  function getReachablePeers(): Set<string> {
    if (dirty) {
      calculate()
      dirty = false
    }
    return reachablePeers
  }

  function addConnection(p1: string, p2: string): void {
    let u = peers.indexOf(p1)
    if (u === -1) {
      dirty = true
      u = peers.length
      peers.push(p1)
    }

    let v = peers.indexOf(p2)
    if (v === -1) {
      dirty = true
      v = peers.length
      peers.push(p2)
    }

    if (!dirty) {
      dirty = matrix[u * maxPeers + v] !== 1
    }

    matrix[u * maxPeers + v] = 1
    matrix[v * maxPeers + u] = 1
  }

  function removeConnection(p1: string, p2: string): void {
    const u = peers.indexOf(p1)
    const v = peers.indexOf(p2)

    if (u === -1 || v === -1) {
      return
    }

    if (!dirty) {
      dirty = matrix[u * maxPeers + v] !== 0
    }

    matrix[u * maxPeers + v] = 0
    matrix[v * maxPeers + u] = 0
  }

  function removePeer(p: string): void {
    const deletedPeerIndex = peers.indexOf(p)
    if (deletedPeerIndex === -1) {
      return
    }

    dirty = true
    const lastPeerIndex = peers.length - 1

    if (deletedPeerIndex !== lastPeerIndex) {
      // if the peer to delete is not the last one, move it to the last
      for (let j = 0; j < maxPeers; j++) {
        matrix[deletedPeerIndex * maxPeers + j] = matrix[lastPeerIndex * maxPeers + j]
      }

      for (let j = 0; j < maxPeers; j++) {
        matrix[j * maxPeers + deletedPeerIndex] = matrix[j * maxPeers + lastPeerIndex]
      }

      peers[deletedPeerIndex] = peers[lastPeerIndex]
    }

    // always fill the removed element (the last) with zeros in the matrix
    for (let j = 0; j < maxPeers; j++) {
      matrix[lastPeerIndex * maxPeers + j] = 0
      matrix[j * maxPeers + lastPeerIndex] = 0
    }

    peers.pop()
  }

  // primMST
  function calculate() {
    // A utility function to find the vertex with
    // minimum key value, from the set of vertices
    // not yet included in MST
    function minKey(key: number[], mstSet: boolean[]): number {
      // Initialize min value
      let min = Number.MAX_VALUE
      let min_index: number = 0

      for (let v = 0; v < peers.length; v++) {
        if (mstSet[v] === false && key[v] < min) {
          min = key[v]
          min_index = v
        }
      }

      return min_index
    }

    // Array to store constructed MST
    const parent: number[] = []

    // Key values used to pick minimum weight edge in cut
    const key: number[] = []

    // To represent set of vertices included in MST
    const mstSet: boolean[] = []

    // Initialize all keys as INFINITE
    for (let i = 0; i < peers.length; i++) {
      key[i] = Number.MAX_VALUE
      mstSet[i] = false
    }

    // Always include first 1st vertex in MST.
    // Make key 0 so that this vertex is picked as first vertex.
    key[0] = 0
    parent[0] = -1 // First node is always root of MST

    // The MST will have V vertices
    for (let count = 0; count < peers.length - 1; count++) {
      // Pick the minimum key vertex from the
      // set of vertices not yet included in MST
      const u = minKey(key, mstSet)

      // Add the picked vertex to the MST Set
      mstSet[u] = true

      // Update key value and parent index of
      // the adjacent vertices of the picked vertex.
      // Consider only those vertices which are not
      // yet included in MST
      for (let v = 0; v < peers.length; v++)
        // matrix[u][v] is non zero only for adjacent vertices of m
        // mstSet[v] is false for vertices not yet included in MST
        // Update the key only if matrix[u][v] is smaller than key[v]
        if (matrix[u * maxPeers + v] && mstSet[v] === false && matrix[u * maxPeers + v] < key[v]) {
          parent[v] = u
          key[v] = matrix[u * maxPeers + v]
        }
    }

    reachablePeers.clear()
    const mstEdges: Edge[] = []
    for (let i = 1; i < peers.length; i++) {
      if (parent[i] !== undefined) {
        const u = peers[parent[i]]
        const v = peers[i]
        reachablePeers.add(u)
        reachablePeers.add(v)
        mstEdges.push({ u, v })
      }
    }
    mst = mstEdges
  }

  function asDot(): string {
    const mst: Edge[] = getMST()

    const dot: string[] = []

    dot.push('graph {')
    for (let u = 0; u < peers.length; u++) {
      dot.push(peers[u])
    }

    for (let u = 0; u < peers.length; u++) {
      for (let v = u; v < peers.length; v++) {
        if (matrix[u * maxPeers + v]) {
          if (
            mst.find(({ u: _u, v: _v }) => (_u === peers[u] && _v === peers[v]) || (_v === peers[u] && _u === peers[v]))
          ) {
            dot.push(`${peers[u]} -- ${peers[v]} [color=red]`)
          } else {
            dot.push(`${peers[u]} -- ${peers[v]}`)
          }
        }
      }
    }
    dot.push('}')
    return dot.join('\n')
  }

  function asMatrixString(): string {
    const padding = peerId.length
    let s = ''

    // space for the vertical names
    s += ''.padStart(padding, ' ')
    s += ' '

    for (let u = 0; u < peers.length; u++) {
      s += peers[u].padStart(padding, ' ')
      s += ' '
    }
    s += '\n'

    for (let u = 0; u < peers.length; u++) {
      s += peers[u].padStart(padding, ' ') + ' '
      for (let j = 0; j < peers.length; j++) {
        s += (matrix[u * maxPeers + j] ? '1' : '0').padStart(padding, ' ')
        s += ' '
      }
      s += '\n'
    }

    return s
  }

  return {
    addConnection,
    removeConnection,
    removePeer,
    getMST,
    getReachablePeers,
    asDot,
    asMatrixString
  }
}
