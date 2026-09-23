const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * `@clerk/clerk-expo` only declares `exports["."].default` (no `react-native` /
 * `import` / `require` conditions). With Expo's package-exports resolution that
 * can fail as "Unable to resolve @clerk/clerk-expo" in pnpm monorepos.
 * Falling back to classic `main` resolution fixes Android/iOS bundling.
 */
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
