import { APP_CLUSTER, APP_KEY, VITE_VERCEL_ENV } from '$env/static/private';

export function load() {
  return {
    VITE_VERCEL_ENV: VITE_VERCEL_ENV,
    APP_CLUSTER: APP_CLUSTER,
    APP_KEY: APP_KEY,
  };
}