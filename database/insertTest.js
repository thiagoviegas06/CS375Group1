import { insertToUser } from "./dbConnection.js";

const res = await insertToUser("asd", "fgh");
console.log(res);