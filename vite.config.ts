import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root:'client',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "../shared"),
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Raise the warning ceiling — the main vendor chunk is legitimately
    // large (React, Router, PostHog) but still well-cached.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Hand-picked manual chunks so the largest libraries land in
        // dedicated files that the browser can cache independently of the
        // app code. Everything not matched falls into the default chunk.
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          // React and its tightly-coupled dependencies stay in the main
          // vendor chunk to avoid circular chunk issues. We only split out
          // libraries that are self-contained (no React internals reaching
          // back into them).
          if (id.includes("posthog")) return "vendor-posthog";
          if (id.includes("recharts") || id.includes("/d3-")) return "vendor-charts";
          if (
            id.includes("xlsx") ||
            id.includes("jspdf") ||
            id.includes("html2canvas")
          ) {
            return "vendor-export";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    fs: {
      allow: [".", ".."],
    },
    proxy: {
      "/api": "http://localhost:3000",
      "/uploads": "http://localhost:3000",
    },
  },
});

