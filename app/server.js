const express = require('express');
const axios = require('axios');
const app = express();
const { UserTable } = require('./models/tables.js');
const path = require('path');
const port = 3000;
const hostname = 'localhost';
let http = require("http");
let { Server } = require("socket.io");
let server = http.createServer(app);
let io = new Server(server);
const session = require('express-session');
const sharedsession = require('express-socket.io-session');

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: 'SecretKey1',
  resave: false,
  saveUninitialized: true,
});
app.use(sessionMiddleware);
io.use(sharedsession(sessionMiddleware, {
  autoSave: true,
}));

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
    if (user) {
      if (password === user.password) {
        req.session.username = username;
        req.session.save()
        res.json({ success: true, message: 'Login successful' });
      } else {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
      }
    } else {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/guest-username', (req, res) => {
  const username = req.body.username;
  console.log("USERNAME HERE " + username)
  req.session.username = username;
  req.session.save()
});

app.get('/get-username', (req, res) => {
  if (req.session.username) {
    res.json({ success: true, username: req.session.username });
  } else {
    res.json({ success: false, message: 'No username found in session' });
  }
});

let rooms = {};
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

function updateRoomUsers(roomId) {
  const userList = rooms[roomId].users.map(user => ({
    username: user.username,
    isPartyLeader: user.isPartyLeader,
  }));

  // Emit the updated user list to all clients in the room
  for (let socket of Object.values(rooms[roomId].sockets)) {
    socket.emit('updateUserList', userList);
  }
}

app.post("/create", (req, res) => {
  let roomId = generateRoomCode();
  rooms[roomId] = {
    users: [],
    sockets: {},
  };
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
    let user = {
      socketID: socket.id,
      userId: username,
    }
    rooms[roomId]["users"].append(user)
    console.log(rooms[roomId]["users"])
  return res.json({ users });
});

// if you need to do things like associate a socket with a logged in user, see
// https://socket.io/how-to/deal-with-cookies
// to see how you can fetch application cookies from the socket

io.on("connection", (socket) => {
  console.log(`Socket ${socket.id} connected`);

  let username = ""

  console.log(socket.handshake.session)
  if (socket.handshake.session.username) {
    username = socket.handshake.session.username;
  } else {
    username = "AwayAntolope27";
  }
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
  rooms[roomId].sockets[socket.id] = socket;
  
  let isPartyLeader = rooms[roomId].users.length === 0 //if first person to join, then you are the party leader

  rooms[roomId].users.push({
    socketId: socket.id,
    username: username,
    isPartyLeader: isPartyLeader,
  });

  updateRoomUsers(roomId);


  /* MUST REGISTER socket.on(event) listener FOR EVERY event CLIENT CAN SEND */

  socket.on("disconnect", () => {
    // disconnects are normal; close tab, refresh, browser freezes inactive tab, ...
    // want to clean up global object, or else we'll have a memory leak
    // WARNING: sockets don't always send disconnect events
    // so you may want to periodically clean up your room object for old socket ids
    console.log(`Socket ${socket.id} disconnected`);
    rooms[roomId].users = rooms[roomId].users.filter(user => user.socketId !== socket.id);
    delete rooms[roomId].sockets[socket.id];

    // Notify all clients in the room about the updated user list
    updateRoomUsers(roomId);
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
