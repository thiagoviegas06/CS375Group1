const express = require('express');
const axios = require('axios');
const session = require('express-session');
const bodyParser = require('body-parser');
const store = new session.MemoryStore();
const app = express();
const { UserTable } = require('./models/tables.js');
const path = require('path');
const port = 3000;
const hostname = 'localhost';
let http = require("http");
let { Server } = require("socket.io");
let server = http.createServer(app);
let io = new Server(server);

app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.set('views', __dirname + path.sep + 'public');

app.use(session(
  {
    secret: 'cs375_group_one',
    cookie: {
      maxAge: 30 * 60 * 1000
    },
    saveUninitialized: false,
    store: store
  }
))
app.use(express.static('public'));
app.use(express.json());

const userTable = new UserTable();  // Table to interact with database

app.get('/', (req, res) => {
  res.sendFile('index.html');
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await userTable.findByUsername(username);

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists. Please choose another one.' });
    }

    await userTable.insert(username, password);
    res.json({ success: true, message: 'User registered successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await userTable.findByUsername(username);
    if (req.session.authenticated) {
      res.json({ success: true, message: 'Already logged in' });
    }
    else {
      if (user) {
        if (password === user.password) {
          req.session.authenticated = true;
          req.session.user = username;
          res.json({ success: true, message: 'Login successful' });
        } else {
          res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
      } else {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
      }
    }

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post("/logout", (req, res) => {
  if (!req.session.authenticated) {
    return res.status(400).json({ success: false, message: 'No session' });
  }
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Failed to destroy' });
    }
  });
  return res.status(200).json({ success: true, message: 'Session ended' });
});

app.get("/myprofile", async (req, res) => {
  if (!req.session.authenticated) {
    return res.sendFile("public/profile_logged_out.html", { root: __dirname });
  }
  const cookieJSON = store["sessions"][req.sessionID];
  const cookie = JSON.parse(cookieJSON);
  const picPath = `profile_pic/${cookie.user}.jpg`;
  return res.render('profile_logged_in.html', { name: cookie.user, pic: picPath });
})

let rooms = {};
let users = {};
function generateRoomCode() {
  let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// for debugging
function printRooms() {
  for (let [roomId, sockets] of Object.entries(rooms)) {
    console.log(roomId);
    for (let [socketId, socket] of Object.entries(sockets)) {
      console.log(`\t${socketId}`);
    }
  }
}

app.post("/create", (req, res) => {
  let roomId = generateRoomCode();
  rooms[roomId] = {};
  return res.json({ roomId });
});

app.get("/room/:roomId", (req, res) => {
  let { roomId } = req.params;
  if (!rooms.hasOwnProperty(roomId)) {
    return res.status(404).send();
  }
  console.log("Sending room", roomId);
  // could also use server-side rendering to create the HTML
  // that way, we could embed the room code
  // and existing chat messages in the generated HTML
  // but the client can also get the roomId from the URL
  // and use Ajax to request the messages on load
  res.sendFile("public/room.html", { root: __dirname });
});

app.post("/room/:roomId", (req, res) => {
  let roomId = req.body.roomId;
  let userId = req.body.userId;
  users[roomId] = { userId };
  return res.json({ users });
});

// if you need to do things like associate a socket with a logged in user, see
// https://socket.io/how-to/deal-with-cookies
// to see how you can fetch application cookies from the socket

io.on("connection", (socket) => {
  console.log(`Socket ${socket.id} connected`);

  // extract room ID from URL
  // could also send a separate registration event to register a socket to a room
  // might want to do that ^ b/c not all browsers include referer, I think
  let url = socket.handshake.headers.referer;
  let pathParts = url.split("/");
  let roomId = pathParts[pathParts.length - 1];
  console.log(pathParts, roomId);

  // room doesn't exist - this should never happen, but jic
  if (!rooms.hasOwnProperty(roomId)) {
    return;
  }

  // add socket object to room so other sockets in same room
  // can send messages to it later
  rooms[roomId][socket.id] = socket;

  /* MUST REGISTER socket.on(event) listener FOR EVERY event CLIENT CAN SEND */

  socket.on("disconnect", () => {
    // disconnects are normal; close tab, refresh, browser freezes inactive tab, ...
    // want to clean up global object, or else we'll have a memory leak
    // WARNING: sockets don't always send disconnect events
    // so you may want to periodically clean up your room object for old socket ids
    console.log(`Socket ${socket.id} disconnected`);
    delete rooms[roomId][socket.id];
  });

  socket.on("foo", ({ message }) => {
    // we still have a reference to the roomId defined above
    // b/c this function is defined inside the outer function
    console.log(`Socket ${socket.id} sent message: ${message}, ${roomId}`);
    console.log("Broadcasting message to other sockets");

    // this would send the message to all other sockets
    // but we want to only send it to other sockets in this room
    // socket.broadcast.emit("message", message);

    for (let otherSocket of Object.values(rooms[roomId])) {
      // don't need to send same message back to socket
      // socket.broadcast.emit automatically skips current socket
      // but since we're doing this manually, we need to do it ourselves
      if (otherSocket.id === socket.id) {
        continue;
      }
      console.log(`Sending message ${message} to socket ${otherSocket.id}`);
      otherSocket.emit("bar", message);
    }
  });

  socket.on("hello", (data) => {
    console.log(data);
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}`);
});
