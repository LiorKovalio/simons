import Pusher from "pusher";
import { APP_CLUSTER, APP_ID, APP_KEY, APP_SECRET } from '$env/static/private';

export const pusher = new Pusher({
  // connect to pusher
  appId: APP_ID,
  key: APP_KEY,
  secret: APP_SECRET,
  cluster: APP_CLUSTER
});

export async function channels(): Promise<string[]> {
  const res = await pusher.get({ path: "/channels" });
  if (res.status === 200) {
    const body = await res.json();
    return body.channels;
  }
  console.error({ type: "channels", msg: res, });
  return [];
}
