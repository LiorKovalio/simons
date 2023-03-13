const express = require("express");
const bodyParser = require("body-parser");
const Pusher = require("pusher");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

require("dotenv").config();

let waitingList = [];

const pusher = new Pusher({
  // connect to pusher
  appId: process.env.APP_ID,
  key: process.env.APP_KEY,
  secret: process.env.APP_SECRET,
  cluster: process.env.APP_CLUSTER
});

app.post("/pusher/auth", function (req, res) {
  const username = req.body.username;

  if (waitingList.indexOf(username) === -1) {
    waitingList.push(username);
    console.log("connecting", username);

    if (waitingList.length >= 2) {
      let p1, p2;
      [p1, p2, ...waitingList] = waitingList;
      console.log(`pairing up {${p1} , ${p2}}`);

      // trigger a message to player one and player two on their own channels
      pusher.trigger(
        ["private-user-" + p1, "private-user-" + p2],
        "paired",
        {
          players: [p1, p2],
        }
      );
    } else {
      pusher.trigger(
        ["private-user-" + username],
        "waiting_for_opponent",
        {}
      );
    }

    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
    console.log(socketId, channel);
    const auth = pusher.authorizeChannel(socketId, channel);
    res.send(auth);
  } else {
    res.status(400);
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Express app running at http://localhost:${port}/`);
});
