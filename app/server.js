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
const sharedsession = require('express-socket.io-session');

app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.set('views', __dirname + path.sep + 'public');

const sessionMiddleware = session({
  secret: 'cs375_group_one',
  resave: false,
  saveUninitialized: false,
  store: store,
  cookie: {
    maxAge: 30 * 60 * 1000
  }
});

app.use(sessionMiddleware);

io.use(sharedsession(sessionMiddleware, {
  autoSave: true,
}));

const userTable = new UserTable();

app.get('/', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.redirect('/create.html');
  } else {
    res.sendFile('index.html', { root: __dirname + '/public' });
  }
});

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/myprofile", async (req, res) => {
  if (!req.session.authenticated) {
    return res.sendFile("public/profile_logged_out.html", { root: __dirname });
  }
  const cookieJSON = store["sessions"][req.sessionID];
  const cookie = JSON.parse(cookieJSON);
  const picPath = `profile_pic/${cookie.user}.jpg`;
  return res.render('profile_logged_in.html', { name: req.session.username, pic: picPath });
})

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
          req.session.username = username;
          req.session.save()
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

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.post('/guest-username', (req, res) => {
  const username = req.body.username;
  req.session.authenticated = true;
  req.session.guestname = username;
  req.session.save()

  res.json({ success: true, message: 'Guest username successful' });
});

app.get('/get-username', (req, res) => {
  if (req.session.username) {
    res.json({ success: true, username: req.session.username});
  } else if (req.session.guestname) {
    res.json({ success: true, username: req.session.guestname});
  } else {
    res.json({ success: false, message: 'No username found in session' });
  }
});

let rooms = {
  roomId: {
    users: [],
    sockets: {},
    votingActive: false,
    votes: {},
    usersFinishedVoting: [],
    restaurants: [],
  },
};

function generateRoomCode() {
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function updateRoomUsers(roomId) {
  const userList = rooms[roomId].users.map(user => ({
    username: user.username,
    isPartyLeader: user.isPartyLeader,
  }));

  for (let socket of Object.values(rooms[roomId].sockets)) {
    socket.emit('updateUserList', userList);
  }
}

function checkVotingDone(roomId) {
  const room = rooms[roomId];

  if (!room.votingActive) {
    return;
  }

  if (room.usersFinishedVoting.length === room.users.length) {
    const results = calculateResults(room.votes, room.restaurants);
  
    for (let s of Object.values(room.sockets)) {
      s.emit('votingResults', { results });
    }
    room.votingActive = false;
  }
}

app.post('/create', (req, res) => {
  let roomId = generateRoomCode();
  rooms[roomId] = {
    users: [],
    sockets: {},
    votingActive: false,
    votes: {},
    usersFinishedVoting: [],
    restaurants: []
  };
  return res.json({ roomId });
});

app.get('/room/:roomId', (req, res) => {
  let { roomId } = req.params;
  if (!rooms.hasOwnProperty(roomId)) {
    return res.status(404).send();
  }
  res.sendFile('public/room.html', { root: __dirname });
});

io.on('connection', (socket) => {
  console.log(`Socket ${socket.id} connected`);

  socket.on('joinRoom', (data) => {
    const { roomId } = data;
    const username = socket.handshake.session.username || socket.handshake.session.guestname || 'GUEST';

    if (!rooms.hasOwnProperty(roomId)) {
      socket.emit('error', { message: 'Room does not exist.' });
      return;
    }

    socket.roomId = roomId;
    rooms[roomId].sockets[socket.id] = socket;

    let isPartyLeader = rooms[roomId].users.length === 0;

    rooms[roomId].users.push({
      socketId: socket.id,
      username: username,
      isPartyLeader: isPartyLeader,
    });

    const room = rooms[roomId];
    if (room.votingActive) {
      socket.emit('startVoting', { restaurants: room.restaurants });
    }

    updateRoomUsers(roomId);
  });


  socket.on('disconnect', () => {
    const roomId = socket.roomId;

    if (roomId && rooms[roomId]) {
      const userIndex = rooms[roomId].users.findIndex(user => user.socketId === socket.id);
      const username = rooms[roomId].users[userIndex].username;
      if (userIndex !== -1) {
        rooms[roomId].users.splice(userIndex, 1);
      }

      if (rooms[roomId].votes[username]) {
        delete rooms[roomId].votes[username];
      }

      let index = rooms[roomId].usersFinishedVoting.indexOf(username);
      if (index !== -1) {
        rooms[roomId].usersFinishedVoting.splice(index, 1);
      }

      if (!rooms[roomId].users.some(user => user.isPartyLeader)) {
        if (rooms[roomId].users.length > 0) {
          rooms[roomId].users[0].isPartyLeader = true;
        }
      }

      delete rooms[roomId].sockets[socket.id];
      updateRoomUsers(roomId);
      checkVotingDone(roomId);
    }

    console.log(`Socket ${socket.id} disconnected`);
  });

  socket.on('startVoting', () => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    const user = room.users.find(u => u.socketId === socket.id);
  
    if (!user || !user.isPartyLeader) {
      return;
    }
  
    room.votingActive = true;
    room.votes = {};
    room.usersFinishedVoting = [];
    room.restaurants = getDummyRestaurants();
  
    for (let s of Object.values(room.sockets)) {
      s.emit('startVoting', { restaurants: room.restaurants });
    }
  });

  socket.on('submitCurrentVotes', (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    const username = socket.handshake.session.username || socket.handshake.session.guestname || 'GUEST';
  
    room.votes[username] = data.votes;

    const results = calculateResults(room.votes, room.restaurants);
  
    for (let s of Object.values(room.sockets)) {
      s.emit('votingResults', { results });
    }
  });

  socket.on('submitVotes', (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    const username = socket.handshake.session.username || socket.handshake.session.guestname || 'GUEST';
  
    room.votes[username] = data.votes;
    if (!room.usersFinishedVoting.includes(username)) {
      room.usersFinishedVoting.push(username);
    }

    checkVotingDone(roomId);
  });
  
});

function calculateResults(votes, restaurants) {
  const restaurantScores = Object.fromEntries(restaurants.map(restaurant => [restaurant.name, 0]));

  for (const userVotes of Object.values(votes)) {
    for (const [restaurant, score] of Object.entries(userVotes)) {
      restaurantScores[restaurant] += score;
    }
  }

  return Object.entries(restaurantScores).sort((a, b) => b[1] - a[1]).map(([name, score]) => ({ name, score }));
}

function getDummyRestaurants() {
  return [
    { id: 1, name: 'Restaurant A', picture: "https://uploads.dailydot.com/2024/07/side-eye-cat.jpg?q=65&auto=format&w=1600&ar=2:1&fit=crop"},
    { id: 2, name: 'Restaurant B', picture: "https://pbs.twimg.com/media/GDQTNcgXMAAbTcI.jpg:large" },
    { id: 3, name: 'Restaurant C', picture: "https://i.giphy.com/2zUn8hAwJwG4abiS0p.webp"},
    { id: 4, name: 'Restaurant D', picture: "https://media.tenor.com/v6j3qu9ZmMIAAAAM/funny-cat.gif" }
  ];
}


server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}`);
});