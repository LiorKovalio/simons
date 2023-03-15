import { APP_CLUSTER, APP_KEY } from '$env/static/private';

export function load() {
  return {
    APP_CLUSTER: APP_CLUSTER,
    APP_KEY: APP_KEY,
  };
}