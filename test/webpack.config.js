const orig = require('../webpack.config')
const path = require('path')

module.exports = {
  ...orig,
  entry: './index.ts',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'out')
  }
}
