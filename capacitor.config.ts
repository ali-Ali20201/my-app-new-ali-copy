import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.store.app',
  appName: 'متجر الشحن',
  webDir: 'dist',
  server: {
    url: 'https://ais-pre-mu7c3fhlcourpjcqqugw4j-425830834467.europe-west2.run.app',
    cleartext: true
  }
};

export default config;
