import Pusher from "pusher";
import { APP_CLUSTER, APP_ID, APP_KEY, APP_SECRET } from '$env/static/private';

let waitingList: string[] = [];

export const pusher = new Pusher({
  // connect to pusher
  appId: APP_ID,
  key: APP_KEY,
  secret: APP_SECRET,
  cluster: APP_CLUSTER
});

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    console.log("here");
    console.log(await request.text());
    const data = await request.json();
    const username = data.username;

    if (waitingList.indexOf(username) === -1) {
      waitingList.push(username);
      console.log("connecting", username);
  
      if (waitingList.length >= 2) {
        let p1, p2;
        [p1, p2, ...waitingList] = waitingList;
        console.log(`pairing up {${p1} , ${p2}}`);
  
        // trigger a message to player one and player two on their own channels
        await pusher.trigger(
          ["private-user-" + p1, "private-user-" + p2],
          "paired",
          {
            players: [p1, p2],
          }
        );
      } else {
        await pusher.trigger(
          ["private-user-" + username],
          "waiting_for_opponent",
          {}
        );
      }
  
      const socketId = data.socket_id;
      const channel = data.channel_name;
      console.log(socketId, channel);
      const auth = pusher.authorizeChannel(socketId, channel);
      return auth;
    } else {
      return 400;
    }
}
