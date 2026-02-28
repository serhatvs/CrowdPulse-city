import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET ?? "http://127.0.0.1:3001";

export default defineConfig({
  envDir: "../../",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          map: ["leaflet", "react-leaflet"],
          web3: ["ethers"],
          modal: ["react-modal"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": devProxyTarget,
      "/health": devProxyTarget,
    },
  },
});
