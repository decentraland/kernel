const path = require('path')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const webpack = require('webpack')
const isProduction = process.env.NODE_ENV !== 'development'

module.exports = {
  entry: './packages/entryPoints/index.ts',
  devtool: isProduction ? undefined : 'inline-source-map',
  mode: isProduction ? 'production' : 'development',
  optimization: {
    nodeEnv: isProduction ? 'production' : 'development',
    minimize: isProduction
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false
        }
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader'
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.mjs'],
    plugins: [new TsconfigPathsPlugin({ configFile: path.resolve(__dirname, 'tsconfig.json') })],
    fallback: {
      // TODO: remove the need of those fallbacks
      crypto: require.resolve('crypto-browserify'),
      https: require.resolve('https-browserify'),
      http: require.resolve('stream-http'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer')
    }
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'static')
  },
  plugins: [
    // Work around for Buffer is undefined:
    // https://github.com/webpack/changelog-v5/issues/10
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser'
    })
  ]
}
