import path from "node:path"

/**
 * Run a package-local command against staged files, with paths relative to that package.
 * @param {string} filter
 * @param {string} packageDir
 * @param {string[]} filenames
 * @param {string} binCommand
 */
function packageExec(filter, packageDir, filenames, binCommand) {
  const relativeFiles = filenames
    .map((filename) => path.relative(packageDir, filename).split(path.sep).join("/"))
    .filter((filename) => !filename.startsWith(".."))
    .map((filename) => `"${filename}"`)

  if (relativeFiles.length === 0) {
    return []
  }

  return [`pnpm --filter ${filter} exec ${binCommand} ${relativeFiles.join(" ")}`]
}

/** @type {import("lint-staged").Configuration} */
export default {
  "*.{json,md,yml,yaml,css}": ["prettier --write"],

  "apps/web/**/*.{js,jsx,ts,tsx}": (filenames) => [
    `prettier --write ${filenames.map((f) => `"${f}"`).join(" ")}`,
    ...packageExec("web", "apps/web", filenames, "eslint --fix --max-warnings=0"),
  ],

  "apps/api/**/*.{js,ts,mjs}": (filenames) => [
    `prettier --write ${filenames.map((f) => `"${f}"`).join(" ")}`,
    ...packageExec("api", "apps/api", filenames, "eslint --fix --max-warnings=0"),
  ],

  "packages/ui/**/*.{js,jsx,ts,tsx}": (filenames) => [
    `prettier --write ${filenames.map((f) => `"${f}"`).join(" ")}`,
    ...packageExec(
      "@workspace/ui",
      "packages/ui",
      filenames,
      "eslint --fix --max-warnings=0"
    ),
  ],

  "packages/{database,validation,eslint-config,typescript-config}/**/*.{js,ts,mjs,cjs}": [
    "prettier --write",
  ],
}
