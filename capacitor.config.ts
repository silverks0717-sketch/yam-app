import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.PUBLIC_APP_ORIGIN?.trim() ||
  'https://yam-web.onrender.com';

const config: CapacitorConfig = {
  appId: 'com.yam.app',
  appName: 'YAM',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: false,
  },
};

export default config;
