import { defineConfig } from "vite"

export default defineConfig({
  base: "/azure-devops-dashboard/",
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-charts': ['chart.js'],
          'vendor-pdf': ['jspdf', 'html2canvas']
        }
      }
    }
  }
})
