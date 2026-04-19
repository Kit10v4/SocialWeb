import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const chunkGroups = {
  "react-vendor": ["react", "react-dom", "react-router-dom"],
  "ui-vendor": ["lucide-react", "@tanstack/react-query"],
};

const isPackageInChunk = (id, packageName) =>
  id.includes(`/node_modules/${packageName}/`) ||
  id.includes(`\\node_modules\\${packageName}\\`);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (
            chunkGroups["react-vendor"].some((pkg) => isPackageInChunk(id, pkg))
          ) {
            return "react-vendor";
          }

          if (chunkGroups["ui-vendor"].some((pkg) => isPackageInChunk(id, pkg))) {
            return "ui-vendor";
          }
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 500,
    // Enable minification
    minify: "esbuild",
    sourcemap: false,
  },
});
