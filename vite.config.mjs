import { glob } from "glob";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  return {
    base: command === "serve" ? "/" : "/static/dist/",
    build: {
      outDir: "static/dist",
      emptyOutDir: true,
      manifest: true,
      rollupOptions: {
        input: glob.sync("static/js/*.js"),
      },
    },
    server: {
      cors: true,
      strictPort: true,
      port: 5173,
    },
  };
});
