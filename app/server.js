const express = require('express');
const axios = require('axios');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');

const store = new session.MemoryStore();
const app = express();
const { UserTable, RestaurantTable, VotingTable } = require('./models/tables.js');
const path = require('path');
const fs = require('fs');
const upload = multer({
  dest: path.join(__dirname, 'public/profile_pic'),
});
const port = 3000;
const hostname = 'localhost';
let http = require("http");
let { Server } = require("socket.io");
let server = http.createServer(app);
let io = new Server(server);
const sharedsession = require('express-socket.io-session');


//thiagos 
let apiFile = require("../env.json");
let yelpKey = apiFile["yelp_key"];
let googleKey = apiFile["google_key"]; 

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

  const profilePicDir = path.join(__dirname, 'public', 'profile_pic');
  const cookieJSON = store["sessions"][req.sessionID];
  const cookie = JSON.parse(cookieJSON);
  const favs = await VotingTable.getVotes(cookie.pid, 3);
  fs.readdir(profilePicDir, (err, files) => {
    if (err) {
      console.error('Error reading profile_pic directory:', err);
      return res.status(500).send('Internal Server Error');
    }

    const regex = new RegExp(`^${cookie.username}\\.(jpg|jpeg|png|gif|bmp)$`, 'i');
    const matchedFile = files.find((file) => regex.test(file));
    if (matchedFile) {
      picPath = `/profile_pic/${matchedFile}`;
    } else {
      picPath = `/profile_pic/default.png`;
    }
    return res.render('profile_logged_in.html', { name: req.session.username, pic: picPath, favs: favs });
  });
})

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await UserTable.findByUsername(username);

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists. Please choose another one.' });
    }

    await UserTable.insert(username, password);
    res.json({ success: true, message: 'User registered successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await UserTable.findByUsername(username);
    if (req.session.authenticated) {
      res.json({ success: true, message: 'Already logged in' });
    }
    else {
      if (user) {
        if (password === user.password) {
          req.session.authenticated = true;
          req.session.username = username;
          req.session.pid = user.pid;
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
    console.log(error);
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

app.post('/restaurant', async (req, res) => {
  try {
    const restaurantName = req.body.restaurant;
    await RestaurantTable.insert(restaurantName);
    return res.sendStatus(200);
  }
  catch (_) {
    return res.sendStatus(500);
  }
});

app.post('/vote', async (req, res) => {
  if (!req.session.authenticated) {
    return res.sendStatus(200);
  }
  try {
    const username = req.session.username;
    const user = await UserTable.findByUsername(username);
    const id = user.pid;
    await VotingTable.incrementVote(id, req.body.restaurant);
    return res.sendStatus(200);
  }
  catch (_) {
    return res.sendStatus(500);
  }
});

app.get("/preferences", (_, res) =>{
  res.sendFile(__dirname + "/public/preferences.html");
});

app.get("/nomination", (_, res) => {
  res.sendFile(__dirname + "/public/nomination.html")
});

function sendYelp(pref, roomID) {
  const options = {
    method: 'GET',
    url: `https://api.yelp.com/v3/businesses/search?location=${pref.city}&price=${pref.price}&limit=10&categories=${pref.cuisine}`,
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${yelpKey}`
    }
  };

  let currentRoom = rooms.roomID;
  if (!currentRoom) {
    console.error(`Room with ID ${roomID} not found.`);
    return;
  }

  axios.request(options)
    .then((yelpRes) => {
      let businesses = yelpRes.data.businesses;
      let restaurantData = {}; // Dictionary to hold restaurant details

      for (let business of businesses) {
        let name = business.name;
        let alias = business.alias;
        let googleAlias = alias.replace(/-/g, "&");

        restaurantData[name] = {
          yelp: {
            price: business.price,
            rating: business.rating,
            location: business.location,
            phone: business.display_phone,
            isOpen: business.hours?.[0]?.is_open_now || null, // Use optional chaining to prevent errors
            attributes: business.attributes || {}, // Default to an empty object if undefined
          },
          alias: googleAlias,
          photos: [], // Placeholder for Google photo references
        };
      }

      // Update the currentRoom's restaurant data
      currentRoom.restaurants = restaurantData;
      console.log(`Updated room ${roomID} with Yelp restaurant data.`);
    })
    .catch((error) => {
      console.error(`Error fetching Yelp data: ${error.message}`);
    });
}

function sendGoogle(pref, roomID) {
  // Retrieve restaurants from the room by roomID
  const currentRoomRestaurants = rooms[roomID]?.restaurants;
  if (!currentRoomRestaurants) {
    console.error(`Room with ID ${roomID} not found or has no restaurants.`);
    return;
  }

  // Prepare an array for promises
  const googlePromises = [];

  // Loop through the restaurants to get aliases and make Google API requests
  for (const [name, restaurant] of Object.entries(currentRoomRestaurants)) {
    const alias = restaurant.alias;
    const google_url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?fields=formatted_address%2Cname%2Crating%2Copening_hours%2Cgeometry%2Cphotos&input=${alias}&inputtype=textquery&key=${googleKey}`;

    // Add a promise for each Google API request
    googlePromises.push(
      axios
        .request({
          method: 'GET',
          url: google_url,
          headers: { accept: 'application/json' },
        })
        .then((res2) => {
          const apiResponse = res2.data;

          // If photos are available, add their references to the restaurant
          if (apiResponse?.candidates?.[0]?.photos) {
            apiResponse.candidates[0].photos.forEach((photo) => {
              restaurant.photos.push(photo.photo_reference);
            });
          }
        })
        .catch((err) => {
          console.error(`Error in Google API request for ${alias}:`, err.response?.data || err.message);
        })
    );
  }

  // Wait for all Google API requests to complete
  return Promise.all(googlePromises)
    .then(() => currentRoomRestaurants)
    .then((updatedRestaurants) => {
      // Fetch photo data
      const photoPromises = [];

      for (const [name, restaurant] of Object.entries(updatedRestaurants)) {
        restaurant.photos.forEach((reference) => {
          const photoRequest = {
            method: 'GET',
            url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${reference}&key=${googleKey}`,
            responseType: 'arraybuffer',
          };

          photoPromises.push(
            axios
              .request(photoRequest)
              .then((photoRes) => {
                const base64Image = Buffer.from(photoRes.data, 'binary').toString('base64');
                restaurant.photos = `data:image/jpeg;base64,${base64Image}`;
              })
              .catch((err) => {
                console.error("Error in photo request:", err.message);
              })
          );
        });
      }

      return Promise.all(photoPromises).then(() => updatedRestaurants);
    })
    .then((finalRestaurants) => {
      // Handle final data
      console.log(`Updated restaurants for room ${roomID}:`, finalRestaurants);
      generateRestaurants(finalRestaurants); // Custom function to process the data
      return finalRestaurants; // Optional return
    })
    .catch((err) => {
      console.error("Error during Google data processing:", err.message);
    });
}



app.get("/preferences-api", (req, res) => {
  let cuisine = req.query.cuisine;
  let price = req.query.price;
  let city = req.query.city;
  let radius = req.query.radius;


  console.log({ city, cuisine, price, radius });

  const options = {
    method: 'GET',
    url: `https://api.yelp.com/v3/businesses/search?location=${city}&price=${price}&limit=10&categories=${cuisine}`,
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${yelpKey}`
    }
  };

  // First Yelp API request
  axios.request(options)
  .then(yelpRes => {
    let business = yelpRes.data.businesses;
    let google = [];
    let restaurantData = {}; // Dictionary to hold restaurant details

    for (let a of business) {
      let name = a.name;
      let alias = a.alias;
      let google_alias = alias.replace(/-/g, "&");

      // Add Google alias to the array for API requests
      google.push(google_alias);

      // Initialize the dictionary entry
      restaurantData[name] = {
        yelp: {
          price: a.price,
          rating: a.rating,
          location: a.location,
          phone: a.display_phone,
          isOpen: a.is_open_now,
          attributes: a.attributes,
        },
        photos: [], // Placeholder for Google photo references
      };
    }

    // Make Google API requests
    const googlePromises = google.map((alias, index) => {
      let google_url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?fields=formatted_address%2Cname%2Crating%2Copening_hours%2Cgeometry%2Cphotos&input=${alias}&inputtype=textquery&key=${googleKey}`;

      return axios
        .request({
          method: 'GET',
          url: google_url,
          headers: { accept: 'application/json' },
        })
        .then(res2 => {
          const apiResponse = res2.data;
          const name = Object.keys(restaurantData)[index]; // Map back to restaurant by index

          if (apiResponse && apiResponse.candidates && apiResponse.candidates[0].photos) {
            // Add photo references to the dictionary entry
            apiResponse.candidates[0].photos.forEach(photo => {
              restaurantData[name].photos.push(photo.photo_reference);
            });
          }
        })
        .catch(errg => {
          console.error(`Error in Google API request for ${alias}:`, errg.response?.data || errg.message);
        });
    });

    // Wait for all Google API requests to complete
    return Promise.all(googlePromises).then(() => restaurantData);
  })
  .then(restaurantData => {
    // Make photo requests for each photo reference in the dictionary
    const photoPromises = [];

    for (let name in restaurantData) {
      restaurantData[name].photos.forEach(reference => {
        const photoRequest = {
          method: 'GET',
          url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${reference}&key=${googleKey}`,
          responseType: 'arraybuffer',
        };

        photoPromises.push(
          axios
            .request(photoRequest)
            .then(photoRes => {
              const base64Image = Buffer.from(photoRes.data, 'binary').toString('base64');
              restaurantData[name].photos = `data:image/jpeg;base64,${base64Image}`;
            })
            .catch(err => {
              console.error("Error in photo request:", err.message);
            })
        );
      });
    }

    return Promise.all(photoPromises).then(() => restaurantData);
  })
  .then(restaurantData => {
    // Final response
    console.log(restaurantData);
    generateRestaurants(restaurantData); // Your custom function for handling the final response
    res.json({ restaurants: restaurantData });
  })
  .catch(err => {
    console.error("Error during process:", err.message);
    res.status(500).json({ error: "An error occurred during processing." });
  });
});
    


app.post('/profile_pic', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const userName = req.session.username;
  const ext = path.extname(req.file.originalname);
  const oldPath = req.file.path;
  const newPath = path.join(req.file.destination, `${userName}${ext}`);

  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      console.error('File renaming error:', err);
      return res.status(500).json({ error: 'File renaming failed' });
    }

    res.status(201).json({
      message: 'File uploaded successfully',
      filePath: `/profile_pic/${userName}${ext}`,
    });
  });

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
    updateVotingResults(roomId)
    room.votingActive = false;
  }
}

function updateVotingResults(roomId) {
  const room = rooms[roomId];
  const results = calculateResults(room.votes, room.restaurants);

  for (let s of Object.values(room.sockets)) {
    s.emit('votingResults', { results });
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

app.get('/nominations-call', (req, res) => {

  const dummyCall = {
    method: 'GET',
    url: `https://api.yelp.com/v3/businesses/search?location=philadelphia&price=2&limit=10&categories=mexican`,
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${yelpKey}`
    }
  };

  axios.request(dummyCall)
    .then(dumRes => {
      res.json(dumRes.data); // Send only the response data to the client
    })
    .catch(err => {
      console.error(err); // Log the error for debugging
      res.status(err.response?.status || 500).json({
        error: err.message || 'An error occurred while fetching data from Yelp'
      });
    });
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
      updateVotingResults(roomId);
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
  
    updateVotingResults(roomId)
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

function generateRestaurants(restaurantObj ){
  rest_id= 0;
  rest = [];
  for (let key in restaurantObj) {
    if (restaurantObj.hasOwnProperty(key)) {
      let businessData = restaurantObj[key];
      
      // Destructure the array for easier access
      let [price, rating, location, display_phone, is_open_now, attributes] = businessData;


      rest = {id: rest_id, name: key, 'price': price, 'rating': rating, 'street': location.address1, 'city': location.city, 'zip': location.zip_code, 'phone': display_phone, 'open': is_open_now, 'menu': attributes.menu_url };
    }
  }
}

function getDummyRestaurants() {
  return [
    { id: 1, name: 'Restaurant A', picture: "https://uploads.dailydot.com/2024/07/side-eye-cat.jpg?q=65&auto=format&w=1600&ar=2:1&fit=crop" },
    { id: 2, name: 'Restaurant B', picture: "https://pbs.twimg.com/media/GDQTNcgXMAAbTcI.jpg:large" },
    { id: 3, name: 'Restaurant C', picture: "https://i.giphy.com/2zUn8hAwJwG4abiS0p.webp" },
    { id: 4, name: 'Restaurant D', picture: "https://media.tenor.com/v6j3qu9ZmMIAAAAM/funny-cat.gif" }
  ];
}

app.get("/map", (_, res)=>{
  res.sendFile(__dirname + "/public/map.html")
});


server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}`);
});