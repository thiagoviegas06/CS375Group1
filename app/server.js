const express = require('express');
const axios = require('axios');
const app = express();
const { UserTable } = require('./models/tables.js');
const path = require('path');
const port = 3000;
const hostname = 'localhost';

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
