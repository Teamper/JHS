const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
config.watchFolders.push(path.resolve(__dirname, '../../src'), path.resolve(__dirname, '../../packages'));
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules'), path.resolve(__dirname, '../../node_modules')];
config.resolver.assetExts.push('wasm', 'mp4');
module.exports = config;
