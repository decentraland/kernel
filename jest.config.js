module.exports = {
  globals: {
    "ts-jest": {
      tsconfig: "test/tsconfig.jest.json",
    },
  },
  moduleFileExtensions: ["ts", "js", "tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
    "node_modules/decentraland-rpc/.+\\.(j|t)sx?$": "ts-jest",
    "node_modules/@dcl/legacy-ecs/.+\\.(j|t)sx?$": "ts-jest",
    "node_modules/@dcl/ecs-quests/.+\\.(j|t)sx?$": "ts-jest"
  },
  coverageDirectory: "coverage",
  verbose: true,
  testMatch: ["**/*.test.(ts?(x))"],
  testEnvironment: "jsdom",
  moduleDirectories: ['node_modules', 'packages'],
  setupFiles: ['<rootDir>/test/setup.js'],
  transformIgnorePatterns: [
    "node_modules/(?!(decentraland-rpc/.*"
    + "|@dcl/legacy-ecs"
    + "|@dcl/ecs-quests"
    + ")/)",
  ]
}