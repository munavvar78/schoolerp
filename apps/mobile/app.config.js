const fs = require('node:fs');
const path = require('node:path');

function readApiUrl(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^EXPO_PUBLIC_API_URL=(.*)$/);
    if (!match || !match[1] || process.env.EXPO_PUBLIC_API_URL) continue;
    process.env.EXPO_PUBLIC_API_URL = match[1].trim().replace(/^["']|["']$/g, '');
  }
}

readApiUrl(path.resolve(__dirname, '../../.env'));
readApiUrl(path.resolve(__dirname, '.env'));

const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: 'BharatVidya',
  slug: 'bharatvidya',
  scheme: 'bharatvidya',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  backgroundColor: '#312e81',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#312e81',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'edu.bharatvidya.mobile',
    infoPlist: {
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/icon.png',
  },
  android: {
    package: 'edu.bharatvidya.mobile',
    softwareKeyboardLayoutMode: 'resize',
    usesCleartextTraffic: true,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#312e81',
    },
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-splash-screen'],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    apiUrl,
  },
};

module.exports = config;
