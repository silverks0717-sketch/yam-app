import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yam.app',
  appName: 'YAM',
  webDir: 'public',
  server: {
    url: 'https://yam-web.onrender.com',
    cleartext: false,
  },
};

export default config;
