const io = require('socket.io')(3000);
const express = require("express");
const app = express();

app.use(express.json());

const port = 3000;
const hostname = "localhost";

io.on('connection', socket => {
    console.log(socket.id);
});


app.listen(port, hostname, () => {
    console.log(`Listening at: http://${hostname}:${port}`);
  });