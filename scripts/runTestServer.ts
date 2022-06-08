import { resolve } from 'path'
import express = require('express')
import path = require('path')
import fs = require('fs')
import { Role } from '../packages/shared/comms/v1/proto/broker'
import titere = require('titere')
import WebSocket = require('ws')
import http = require('http')
import proto = require('../packages/shared/comms/v1/proto/broker')

const url = require('url')

// defines if we should run headless tests and exit (true) or keep the server on (false)
const singleRun = !(process.env.SINGLE_RUN === 'true')
const port = process.env.PORT || 8080
const app = express()

const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

const connections = new Set<WebSocket>()
const topicsPerConnection = new WeakMap<WebSocket, Set<string>>()
const aliasToUserId = new Map<number, string>()
let connectionCounter = 0

function getTopicList(socket: WebSocket): Set<string> {
  let set = topicsPerConnection.get(socket)
  if (!set) {
    set = new Set()
    topicsPerConnection.set(socket, set)
  }
  return set
}

wss.on('connection', function connection(ws, req) {
  connections.add(ws)
  const alias = ++connectionCounter

  const query = url.parse(req.url, true).query
  const userId = query['identity']
  aliasToUserId.set(alias, userId)

  ws.on('message', (message) => {
    const data = message as Buffer
    const msgType = proto.CoordinatorMessage.deserializeBinary(data).getType()

    if (msgType === proto.MessageType.PING) {
      ws.send(data)
    } else if (msgType === proto.MessageType.TOPIC) {
      const topicMessage = proto.TopicMessage.deserializeBinary(data)

      const topic = topicMessage.getTopic()

      const topicFwMessage = new proto.TopicFWMessage()
      topicFwMessage.setType(proto.MessageType.TOPIC_FW)
      topicFwMessage.setFromAlias(alias)
      topicFwMessage.setBody(topicMessage.getBody_asU8())

      const topicData = topicFwMessage.serializeBinary()

      // Reliable/unreliable data
      connections.forEach(($) => {
        if (ws !== $) {
          if (getTopicList($).has(topic)) {
            $.send(topicData)
          }
        }
      })
    } else if (msgType === proto.MessageType.TOPIC_IDENTITY) {
      const topicMessage = proto.TopicIdentityMessage.deserializeBinary(data)

      const topic = topicMessage.getTopic()

      const topicFwMessage = new proto.TopicIdentityFWMessage()
      topicFwMessage.setType(proto.MessageType.TOPIC_IDENTITY_FW)
      topicFwMessage.setFromAlias(alias)
      topicFwMessage.setIdentity(aliasToUserId.get(alias))
      topicFwMessage.setRole(Role.CLIENT)
      topicFwMessage.setBody(topicMessage.getBody_asU8())

      const topicData = topicFwMessage.serializeBinary()

      // Reliable/unreliable data
      connections.forEach(($) => {
        if (ws !== $) {
          if (getTopicList($).has(topic)) {
            $.send(topicData)
          }
        }
      })
    } else if (msgType === proto.MessageType.SUBSCRIPTION) {
      const topicMessage = proto.SubscriptionMessage.deserializeBinary(data)
      const rawTopics = topicMessage.getTopics()
      const topics = Buffer.from(rawTopics).toString('utf8')
      const set = getTopicList(ws)

      set.clear()
      topics.split(/\s+/g).forEach(($) => set.add($))
    }
  })

  ws.on('close', () => {
    connections.delete(ws)
    aliasToUserId.delete(alias)
  })

  setTimeout(() => {
    const welcome = new proto.WelcomeMessage()
    welcome.setType(proto.MessageType.WELCOME)
    welcome.setAlias(alias)
    const data = welcome.serializeBinary()

    ws.send(data)
  }, 100)
})

/// --- SIDE EFFECTS ---
{
  app.use(require('cors')())

  app.get('/test', (req, res) => {
    res.writeHead(200, 'OK', {
      'Content-Type': 'text/html'
    })

    res.write(`<!DOCTYPE html>
      <html>

      <head>
        <title>Mocha Tests</title>
        <meta charset="utf-8">
        <link rel="stylesheet" href="/node_modules/mocha/mocha.css">
      </head>

      <body>
        <div id="mocha"></div>
        <script>console.log('test html loaded')</script>
        <script src="/node_modules/mocha/mocha.js"></script>
        <script>mocha.setup('bdd');</script>
        <script src="/test/out/index.js"></script>
      </body>

      </html>
    `)

    res.end()
  })

  app.use(
    '/@/artifacts/index.js',
    express.static(resolve(__dirname, '../static/index.js'), {
      setHeaders: (res) => {
        res.setHeader('Content-Type', 'application/javascript')
      }
    })
  )

  app.use('/@/artifacts/unity-renderer', express.static(path.dirname(require.resolve('@dcl/unity-renderer'))))

  app.use('/default-profile', express.static(resolve(__dirname, '../static/default-profile')))

  app.use(
    '/preview.html',
    express.static(resolve(__dirname, '../static/preview.html'), {
      setHeaders: (res) => {
        res.setHeader('Content-Type', 'text/html')
      }
    })
  )

  app.use(
    '/index.html',
    express.static(resolve(__dirname, '../static/index.html'), {
      setHeaders: (res) => {
        res.setHeader('Content-Type', 'text/html')
      }
    })
  )

  app.use('/test', express.static(resolve(__dirname, '../test')))
  app.use('/node_modules', express.static(resolve(__dirname, '../node_modules')))

  app.use(express.static(path.resolve(__dirname, '..', 'static')))

  server.listen(port, function () {
    console.info('==>     Listening on port %s. Open up http://localhost:%s/test to run tests', port, port)
    console.info('                              Open up http://localhost:%s/ to test the client.', port)

    const options: titere.Options = {
      file: `http://localhost:${port}/test`,
      visible: true,
      height: 600,
      width: 800,
      timeout: 5 * 60 * 1000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--debug-devtools-frontend', '--js-flags="--expose-gc"']
    }

    if (!singleRun) {
      titere
        .run(options)
        .then((result) => {
          if (result.coverage) {
            fs.mkdirSync('test/tmp', { recursive: true })
            fs.writeFileSync('test/tmp/out.json', JSON.stringify(result.coverage))
          }
          process.exit(result.result.stats.failures)
        })
        .catch((err: Error) => {
          console.error(err.message || JSON.stringify(err))
          console.dir(err)
          process.exit(1)
        })
    }
  })
}
