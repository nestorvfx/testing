const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const moduleRoot = path.resolve(projectRoot, './react-native-android-speech');

const config = getDefaultConfig(projectRoot);

// 1. Add the local module directory to watchFolders
config.watchFolders = [moduleRoot];

// 2. Add custom resolver to handle the local module
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(moduleRoot, 'node_modules')
];

// 3. Force the custom module to be treated as a regular module
config.resolver.extraNodeModules = {
  'react-native-android-speech': moduleRoot
};

module.exports = config;