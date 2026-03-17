import { defineConfig } from "vite"

export default defineConfig({
  base: "/azure-devops-dashboard/",
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('chart.js')) {
              return 'vendor-charts';
            }
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return null; // Let Vite handle dynamic splitting
            }
            return 'vendor'; // all other node_modules
          }
        }
      }
    }
  }
})
