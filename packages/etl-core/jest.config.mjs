/** @type {import('jest').Config} */
const config = {
  testRegex: ".*\\.spec\\.ts$",
  passWithNoTests: true,
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@workspace/validation$": "<rootDir>/../validation/src/index.ts",
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
