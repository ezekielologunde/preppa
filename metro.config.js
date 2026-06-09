// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  // Inline CSS variables break PlatformColor() — keep them as runtime variables.
  inlineVariables: false,
  // Allow `className` directly on all React Native primitives (View, Text, ...).
  globalClassNamePolyfill: true,
});
