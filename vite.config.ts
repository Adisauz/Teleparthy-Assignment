import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages hosts under /<repo>/, so allow overriding base at build time.
  // - Local dev: "/"
  // - GitHub Actions: BASE_PATH="/<repo>/"
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
});
