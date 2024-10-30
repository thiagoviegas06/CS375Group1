import { io } from "socket.io-client";

let serverURL = 'http://localhost:3000';

const socket = io(serverURL);