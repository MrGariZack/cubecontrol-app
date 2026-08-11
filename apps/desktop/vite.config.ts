import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  // Required for Electron file:// loading after packaging.
  base: "./",
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              // Native MIDI binary must ship as a real node module.
              // Bundle pure @tonehub/* TS packages into main.js for a self-contained asar.
              external: ["electron", "@julusian/midi"],
            },
          },
        },
      },
      preload: {
        input: "electron/preload.ts",
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
