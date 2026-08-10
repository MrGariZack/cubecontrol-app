const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const appRepoRoot = path.resolve(projectRoot, "../..");
const corePackagesRoot = path.resolve(appRepoRoot, "../Tonehub/packages");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [appRepoRoot, corePackagesRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(appRepoRoot, "node_modules"),
];
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
