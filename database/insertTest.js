import { UserTable } from "./tables.js";

const table = new UserTable();

const res = await table.insert("asd", "fgh");
console.log(res);