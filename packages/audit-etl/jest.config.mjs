/** @type {import('jest').Config} */
const config = {
  testRegex: ".*\\.spec\\.ts$",
  passWithNoTests: true,
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@workspace/etl-core$": "<rootDir>/../etl-core/src/index.ts",
    "^@workspace/etl-core/(.*)$": "<rootDir>/../etl-core/src/$1",
    "^@workspace/database$": "<rootDir>/../database/src/index.ts",
  },
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          moduleResolution: "bundler",
        },
      },
    ],
  },
  testEnvironment: "node",
}

export default config
