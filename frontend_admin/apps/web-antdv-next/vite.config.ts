import { defineConfig } from '@vben/vite-config';

function parseCsvEnv(value?: string) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default defineConfig(async () => {
  const backendTarget =
    process.env.VITE_BACKEND_URL || 'http://localhost:18000';
  const allowedHosts = Array.from(new Set([
    'localhost',
    '127.0.0.1',
    '.ngrok-free.app',
    ...parseCsvEnv(process.env.VITE_DEV_ALLOWED_HOSTS),
  ]));

  return {
    application: {},
    vite: {
      server: {
        allowedHosts,
        host: process.env.VITE_DEV_HOST || '0.0.0.0',
        proxy: {
          '/api': {
            changeOrigin: true,
            target: backendTarget,
            ws: true,
          },
          '/qr': {
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
