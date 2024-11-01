let axios = require("axios");
const express = require("express");
const app = express();
let apiFile = require("../env.json");
let yelpKey = apiFile["yelp_key"];
let yelpUrl = apiFile["yelp_url"];
const port = 3000;
const hostname = "localhost";

app.use(express.static("public"));

app.use(express.json());

app.listen(port, hostname, () => {
    console.log(`Listening at: http://${hostname}:${port}`);
});
