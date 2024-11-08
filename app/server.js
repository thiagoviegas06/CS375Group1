const express = require('express');
const axios = require('axios');
const app = express();
const { UserTable } = require('./models/tables.js');
const path = require('path');
const port = 3000;
const hostname = 'localhost';

//apiFiles
let apiFile = require("../env.json");
let yelpKey = apiFile["yelp_key"];
let yelpClient = apiFile["client_id"];
let googleKey = apiFile["google_key"]; 

app.use(express.static(path.join(__dirname, "public")));
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


app.get("/create", (req, res) => {
  res.sendFile("/create.html");
});

// This is the route that will be used to create a new lobby
// Will require sockets
app.get("/join:id", (req, res) => {
  res.sendFile("/join.html");
});

app.get("/preferences", (req, res) =>{
  res.sendFile(__dirname + "/public/preferences.html");
});

app.get("/preferences-api", (req, res) => {
  let cuisine = req.query.cuisine;
  let price = req.query.price;
  let city = req.query.city;
  let radius = req.query.radius;

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
      let business = yelpRes.data.businesses;

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
          res.json({ yelp: json_response, google: photoArray, image: imageDataUrl });
        });
    })
    .catch(err => console.error("Error in Yelp API request:", err.response.data));
});



//
app.post("/create", (req, res) => {
  let data = req.body;

  // Extract the location and food type from the request body
  // Will be used with yelp api to get the restaurant list
  let location = data.location;
  let foodType = data.foodType;

  // Generate and return the lobby ID
  let id = generateID();
  res.json({ id });
});


// Will be used to generate the lobby ID
// Need to connect with the database to check if the ID is unique
function generateID() {
  let id = "";
  let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 4; i++) {
      id += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return id;
}

app.listen(port, () => {
    console.log(`Server running at http://${hostname}:${port}`);
});
