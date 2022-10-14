import madge = require('madge')
import { sha3 } from 'eth-connect'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'

const baseDir = process.cwd()
type Result = {
  tree: Tree
}
type Tree = Record<string, string[]>

async function main() {
  await processEntryPoint('packages/gif-processor/worker.ts')
  await processEntryPoint('packages/entryPoints/index.ts')
  await processEntryPoint('packages/ui/decentraland-ui.scene.ts')
  await processEntryPoint('packages/voice-chat-codec/audioWorkletProcessors.ts')
  await processEntryPoint('packages/voice-chat-codec/worker.ts')
}

async function processEntryPoint(entryPoint: string) {
  const tsConfig = resolve(dirname(entryPoint), './tsconfig.json')
  console.log({ entryPoint, tsConfig })
  const result: Result = await madge(entryPoint, { baseDir, tsConfig, includeNpm: true })

  function nodeKey(path: string) {
    return 'N' + sha3(path).substring(0, 6)
  }

  const nodes = new Set()

  function* drawNodes() {
    for (const path in result.tree) {
      yield `${nodeKey(path)};`
      nodes.add(path)
      for (let leaf of result.tree[path]) {
        nodes.add(leaf)
        yield `${nodeKey(leaf)};`
      }
    }
  }

  function* drawEdges() {
    for (const from in result.tree) {
      for (const to of result.tree[from]) {
        yield `${nodeKey(from)}->${nodeKey(to)};`
      }
    }
  }

  function* drawClusters() {
    const clusters: Map<string, Set<string>> = new Map()

    function selectClusterName(path: string) {
      if (path.match(/node_modules/))
        return 'node_modules'
      if (path.match(/packages\/shared\/([^/]+)\//))
        return 'packages/shared/' + path.match(/packages\/shared\/([^/]+)\//)[1]
      if (path.match(/packages\/([^/]+)\//)) return 'packages/' + path.match(/packages\/([^/]+)\//)[1]
      return 'unknown'
    }

    function addNode(path: string) {
      const clusterName = selectClusterName(path)
      const cluster = clusters.get(clusterName) || new Set()
      clusters.set(clusterName, cluster)
      cluster.add(path)
    }

    nodes.forEach(addNode)

    let i = 0

    for (const [cluster, nodes] of clusters) {
      yield `subgraph cluster_${i++} {
        style=filled;
        color=lightgrey;
        node [style=filled,color=white, shape=plaintext];
        label = "${cluster}";\n`
      for (const node of nodes) {
        yield `\t${nodeKey(node)} [label=${JSON.stringify(node.replace(cluster + '/', ''))}];`
      }
      yield `}`
    }
  }

  const dot = [
    `digraph G {`,
    `rankdir="LR";`,
    `concentrate=true;`,
    `graph[fontname="Arial",ratio=fill];`,
    `edge[fontname="Arial"];`,
    `node[fontname="Arial",shape=rectangle];`,
    // `splines=polyline;`,
    // `labeljust="l";`,
    '/* Files */',
    ...drawNodes(),
    '\n/* Edges */',
    ...drawEdges(),
    '\n/* Clusters */',
    ...drawClusters(),
    `}`
  ].join('\n')

  writeFileSync(entryPoint + '.dot', dot)
}

main().catch((err) => {
  process.exitCode = 1
  console.error(err)
})
