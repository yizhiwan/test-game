import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor shell for the Android build.
 *
 * `webDir` points at the static export produced by `npm run build:capacitor`.
 *
 * To run the full game with live AI dialogue, set CAP_SERVER_URL to your
 * deployed web app and the shell will load that instead of the bundled files.
 * That is the shortest path to a working APK, because the deployment keeps the
 * API routes that a static bundle cannot host.
 */
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.yourstudio.cyberpunk404",
  appName: "Cyberpunk Lab 404",
  webDir: "out",
  server: {
    androidScheme: "https",
    ...(serverUrl ? { url: serverUrl, cleartext: false } : {}),
  },
};

export default config;
