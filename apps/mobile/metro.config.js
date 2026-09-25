const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * `@clerk/expo` (Core 3) requires Node package exports so Metro can resolve
 * subpaths like `@clerk/react/internal` and `@clerk/react/errors`.
 * Do not set `unstable_enablePackageExports = false` — that was a workaround
 * for the deprecated `@clerk/clerk-expo` package and breaks the current SDK.
 */
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
