import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const jestPackageDir = path.dirname(require.resolve("jest/package.json"))
const jestBin = path.join(jestPackageDir, "bin", "jest.js")

const child = spawn(process.execPath, ["--experimental-vm-modules", jestBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
