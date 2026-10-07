import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cranoly.mono",
  appName: "Cranoly Mono",
  webDir: "out",
  android: {
    backgroundColor: "#000000",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
