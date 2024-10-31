//const io = require('socket.io')(3000);
let axios = require("axios");
const express = require("express");
const app = express();
let apiFile = require("../env.json");
let yelpKey = apiFile["yelp_key"];
let yelpUrl = apiFile["yelp_url"];
const port = 3000;
const hostname = "localhost";


app.use(express.json());


const options = {
  method: 'GET',
  url: 'https://api.yelp.com/v3/categories?locale=en_US',
  headers: {
    accept: 'application/json',
    Authorization: 'nBR5fKiwGG5PTLJ9_Hppjz-vYfcMO-jXqh2XeLf-PxEZliUwb8jSs5n5crjoX31tID1_etrliFwOWkz8aMaB95_eyeh45rBopveokQqh8CngLrg3-Qwo8r7w4gwkZ3Yx'
  }
};

axios
  .request(options)
  .then(res => console.log(res.data))
  .catch(err => console.error(err));

/*io.on('connection', socket => {
    console.log(socket.id);
});
*/


app.listen(port, hostname, () => {
    console.log(`Listening at: http://${hostname}:${port}`);
  });