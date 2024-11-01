let axios = require("axios");
const express = require("express");
const app = express();
let apiFile = require("../env.json");
const port = 3000;
const hostname = "localhost";


app.use(express.json());

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.get("/create", (req, res) => {
    res.sendFile(__dirname + "/create.html");
});

// This is the route that will be used to create a new lobby
// Will require sockets
app.get("/join:id", (req, res) => {
    res.sendFile(__dirname + "/join.html");
});


//
app.post("/create", (req, res) => {
    let data = req.body;
});

app.post("/login", (req, res) => {
    let data = req.body;
    let username = data.username;
    let password = data.password;

    // Connect to the database to check if the user exists
});


app.post("/register", (req, res) => {
    let data = req.body;
    let username = data.username;
    let password = data.password;

    // Connect to the database to check if the user exists
    // If the user does not exist, add the user to the database
});


app.get("/register", (req, res) => {
    res.sendFile(__dirname + "/register.html");
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


app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});