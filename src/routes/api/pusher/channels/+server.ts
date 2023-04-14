import { json } from '@sveltejs/kit';

import { pusher, channels } from '../pusher';

async function channel_subscription_count(channel: string): Promise<number> {
  const req_data = { path: `/channels/${channel}`, params: { info: "subscription_count", } };
  const res = await pusher.get(req_data);
  if (res.status === 200) {
    const body = await res.json();
    console.debug({ type: "channel_subscription_count", sent: req_data, got: body, });
    return body.subscription_count;
  }
  console.error({ type: "channel_subscription_count", sent: req_data, msg: res, });
  return -1;
}

/** @type {import('./$types').RequestHandler} */
export async function GET() {
  const channels_res = await channels();
  console.debug("channels_res", channels_res);
  const channel_names = Object.keys(channels_res);
  const subs = await Promise.all(channel_names.map(c => channel_subscription_count(c)));
  const available = channel_names.filter((_, i) => subs[i] === 1)
  console.log("available", available);
  return json({ channels: available, status: 200 });
}
