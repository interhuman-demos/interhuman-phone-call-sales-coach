import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // dev-local.mts serves the api/ functions here (vercel dev doesn't use this)
    proxy: { "/api": "http://localhost:8788" },
  },
});
