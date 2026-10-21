import { defineConfig } from "vite"

export default defineConfig({
  base: "/azure-devops-dashboard/",
  build: {
    outDir: "dist",
    rollupOptions: {
      external: ["canvg"]
    }
  },
  test: {
    environment: "happy-dom",
    pool: "vmThreads"
  }
})
