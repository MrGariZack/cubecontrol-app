import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              external: [
                "@julusian/midi",
                "@tonehub/midi-transport-node",
                "@tonehub/cube-baby-api",
                "@tonehub/cube-baby-protocol",
                "@tonehub/midi-core",
                "jszip",
              ],

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
