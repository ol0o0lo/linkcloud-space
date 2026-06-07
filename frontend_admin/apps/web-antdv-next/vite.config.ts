import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  const backendTarget =
    process.env.VITE_BACKEND_URL || 'http://localhost:18000';

  return {
    application: {},
    vite: {
      server: {
        allowedHosts: ['localhost', '127.0.0.1', '.ngrok-free.app'],
        proxy: {
          '/api': {
            changeOrigin: true,
            target: backendTarget,
            ws: true,
          },
          '/_allauth': {
            changeOrigin: true,
            target: backendTarget,
            ws: true,
          },
        },
      },
    },
  };
});
