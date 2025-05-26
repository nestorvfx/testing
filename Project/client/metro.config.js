const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Add custom resolver to handle the local module
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(projectRoot, '../node_modules'),
];

// Add extraNodeModules for web compatibility
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  // These are required by the Speech SDK on web
  'stream': require.resolve('stream-browserify'),
  'buffer': require.resolve('buffer/'),
};

module.exports = config;