import { json } from '@sveltejs/kit';

import { pusher, channels } from '../pusher';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    const astext = await request.text();
    console.debug(astext);
    const asquery = new URLSearchParams(astext);
    const username = asquery.get("username")!;

    const channels_res = await channels();

    if (!(`private-user-${username}` in Object.keys(channels_res))) {
      console.log("connecting", username);

      const socketId = asquery.get("socket_id")!;
      const channel = asquery.get("channel_name")!;
      console.log(username, socketId, channel);
      const auth = pusher.authorizeChannel(socketId, channel);
      console.log("auth", auth);

      return json(auth, { status: 200 });
    } else {
      return json({}, { status: 400 });
    }
}
