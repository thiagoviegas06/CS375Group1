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

app.listen(port, () => {
    console.log(`Server running at http://${hostname}:${port}`);
});
