import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/fleet-api": {
        target: "https://trdev.tailff74b1.ts.net",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/fleet-api/, ""),
      },
    },
  },
});
