import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // important for correct asset paths in preview/static
  build: {
    target: "esnext", // important for top-level await in src/main.js
  },
});
