#!/usr/bin/env node
const { build, cliopts } = require("estrella")
const { readFile } = require("fs/promises")
const path = require("path")

const builtIns = {
  crypto: require.resolve("crypto-browserify"),
  stream: require.resolve("stream-browserify"),
  buffer: require.resolve("./node_modules/buffer/index.js")
}

const nodeBuiltIns = (options) => {
  const include = Object.keys(builtIns)
  if (!include.length) {
    throw new Error("Must specify at least one built-in module")
  }
  const filter = RegExp(`^(${include.join("|")})$`)
  return {
    name: "node-builtins",
    setup(build) {
      build.onResolve({ filter }, arg => ({
        path: builtIns[arg.path],
      }))
    },
  }
}


function createWorker(entry, outfile) {
  return build({
    entry,
    outfile,
    tsconfig: path.join(path.dirname(entry), "tsconfig.json"),
    bundle: true,
    minify: !cliopts.watch,
    sourcemap: cliopts.watch ? 'both' : undefined,
    sourceRoot: "packages",
    sourcesContent: !!cliopts.watch,
    treeShaking: true,
    inject: ["packages/entryPoints/inject.js"],
    plugins: [nodeBuiltIns()]
  })
}

createWorker('packages/gif-processor/worker.ts', "static/gif-processor/worker.js.txt")
createWorker('packages/decentraland-loader/lifecycle/worker.ts', "static/loader/worker.js.txt")
createWorker('packages/voice-chat-codec/worker.ts', "static/voice-chat-codec/worker.js.txt")
createWorker('packages/voice-chat-codec/audioWorkletProcessors.ts', "static/voice-chat-codec/audioWorkletProcessors.js.txt")
createWorker('packages/ui/decentraland-ui.scene.ts', "static/systems/decentraland-ui.scene.js.txt")
createWorker('packages/scene-system/scene.system.ts', "static/systems/scene.system.js.txt")

build({
  entry: "packages/entryPoints/index.ts",
  outfile: "static/index.js",
  tsconfig: "packages/entryPoints/tsconfig.json",
  bundle: true,
  minify: !cliopts.watch,
  sourceRoot: "packages",
  sourcemap: cliopts.watch ? 'both' : undefined,
  sourcesContent: !!cliopts.watch,
  treeShaking: true,
  inject: ["packages/entryPoints/inject.js"],
  plugins: [nodeBuiltIns()]
})

// Run a local web server with livereload when -watch is set
cliopts.watch && require("serve-http").createServer({
  port: 8181,
  pubdir: require("path").join(__dirname, "static"),
})
