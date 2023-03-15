import { json } from '@sveltejs/kit';

import Pusher from "pusher";
import { APP_CLUSTER, APP_ID, APP_KEY, APP_SECRET } from '$env/static/private';

let waitingList: string[] = [];

const pusher = new Pusher({
  // connect to pusher
  appId: APP_ID,
  key: APP_KEY,
  secret: APP_SECRET,
  cluster: APP_CLUSTER
});

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    const astext = await request.text();
    console.log(astext);
    const asquery = new URLSearchParams(astext);
    const username = asquery.get("username")!;

    let init_data: {type: string, payload: any};

    if (waitingList.indexOf(username) === -1) {
      waitingList.push(username);
      console.log("connecting", username);

      const socketId = asquery.get("socket_id")!;
      const channel = asquery.get("channel_name")!;
      console.log(username, socketId, channel);
      const auth = pusher.authorizeChannel(socketId, channel);
      console.log("auth", auth);

      init_data = {type: "waiting_for_opponent", payload: {}};

      if (waitingList.length >= 2) {
        let p1, p2;
        [p1, p2, ...waitingList] = waitingList;
        console.log(`pairing up {${p1} , ${p2}}`);
  
        init_data = {type: "paired", payload: {players: [p1, p2]}};
      }
  
      const payload = {...auth, ...init_data};
      console.log("payload", payload);
      return json(payload, { status: 200 });
    } else {
      return json({}, { status: 400 });
    }
}
