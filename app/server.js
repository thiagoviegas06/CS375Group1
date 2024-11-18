const express = require('express');
const axios = require('axios');
const app = express();
const { UserTable } = require('./models/tables.js');
const { RestuarantTable } = require('./models/tables.js');
const path = require('path');
const port = 3000;
const hostname = 'localhost';
let http = require("http");
let { Server } = require("socket.io");
let server = http.createServer(app);
let io = new Server(server);
app.use(express.static('public'));

//apiFiles
let apiFile = require("../env.json");
let yelpKey = apiFile["yelp_key"];
let yelpClient = apiFile["client_id"];
let googleKey = apiFile["google_key"]; 

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const userTable = new UserTable();  // Table to interact with database
const restuarantTable = new RestuarantTable();  // Table to interact with database

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

let rooms = {};
let users= {};
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

app.get("/preferences", (req, res) =>{
  res.sendFile(__dirname + "/public/preferences.html");
});

function getRestuarantFromDB(city, cuisine, price) {
  // Return data from database
}

function storeRestuarantInDB(name, city, cuisine, price, image) {
  // Store data in database
  restuarantTable.insert(name, city, cuisine, price, image);
}


//This is not currently working. Need to fix this before merging. 
async function callYelpAndGoogle(city, cuisine, price, radius) {
  let google = [];
  let json_response = {};

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
      business = yelpRes.data.businesses;

      for (let a of business) {
        let name = a.name;
        let alias = a.alias;
        let google_alias = alias.replace(/-/g, "&");

        // Create array with google requests
        google.push(google_alias);

        // Location and attributes are objects that need to be iterated
        json_response[name] = [a.price, a.rating, a.location, a.display_phone, a.is_closed, a.attributes];
        console.log(json_response[name]);
      }

      // Now that google array is populated, initiate Google API requests
      const googlePromises = google.map(alias => {
        let google_url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?fields=formatted_address%2Cname%2Crating%2Copening_hours%2Cgeometry%2Cphotos&input=${alias}&inputtype=textquery&key=${googleKey}`;

        let google_options = {
          method: 'GET',
          url: google_url,
          headers: {
            accept: 'application/json'
          }
        };

        // Return a promise from each request
        return axios.request(google_options)
          .then(res2 => {
            console.log("Google API response for", alias, ":");
            console.log(res2.data);
            return res2.data;
          })
          .catch(errg => {
            console.error("Error in Google API request for", alias, ":", errg.response.data);
            return null;
          });
      });

      // Wait for all Google API requests to complete
      return Promise.all(googlePromises);
    })
    .then(googleResults => {

      let photoArray = [];

      for (let api_response of googleResults) {
        if (api_response && api_response.candidates && api_response.candidates[0].photos) {
          let reference = api_response.candidates[0].photos[0].photo_reference;
          photoArray.push(reference);
        }
      }

      const photoRequest = {
        method: 'GET',
        url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoArray[0]}&key=${googleKey}`,
        responseType: 'arraybuffer'  // Ensure response is binary data
      };
      
      // Make the image request
      return axios.request(photoRequest)
        .then(photoRes => {
          // Convert the binary data to base64
          const base64Image = Buffer.from(photoRes.data, 'binary').toString('base64');
          const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

          // Return final response including Yelp data and image
          //console.log({ yelp: json_response, google: photoArray, image: imageDataUrl });]
          console.log(json_response.name);
          //storeRestuarantInDB(json_response.name, city, cuisine, price, imageDataUrl);
          return({ yelp: json_response, google: photoArray, image: imageDataUrl });
        });
    })
    .catch(err => console.error("Error in Yelp API request:", err.response.data));

}

app.get("/preferences-api", (req, res) => {
  let cuisine = req.query.cuisine;
  let price = req.query.price;
  let city = req.query.city;
  let radius = req.query.radius;

  if(!getRestuarantFromDB(city, cuisine, price) == null) {
    console.log("Why did this run");
    res.json(getRestuarantFromDB(city, cuisine, price));
  } else {
    let results = callYelpAndGoogle(city, cuisine, price, radius);
    console.log(results);
    storeRestuarantInDB(results);
    res.json(results);
  }
  
});

// Takes the points from the first voting round to determine the winnner.
// If there is a tie, randomly select a winner.
// This is assuming we are going to have 2 rounds of voting and is only in case of tie there too
function tieBreaker(Restuarant1, Restuarant2, pointsRestuarant1, pointsRestuarant2) {
  if (pointsRestuarant1 > pointsRestuarant2) {
    return Restuarant1;
  } else if (pointsRestuarant1 < pointsRestuarant2) {
    return Restuarant2;
  }
  return Math.random() < 0.5 ? Restuarant1 : Restuarant2;
  
}



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
