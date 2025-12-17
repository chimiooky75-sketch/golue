import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Cast process to any to avoid type error regarding cwd()
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // This ensures code using `process.env.API_KEY` works in the browser
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    }
  };
});