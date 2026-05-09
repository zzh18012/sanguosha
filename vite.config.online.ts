import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Online build — no singlefile inlining, multi-file output for deployment
export default defineConfig({
  plugins: [react()],
  base: './',
})
