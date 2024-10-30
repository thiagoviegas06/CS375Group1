import pg from 'pg';
import dbconn from "../env.json" assert {type: 'json'}
import { UserTable } from './tables.js';

const localPool = new pg.Pool(
    {
        user: dbconn.username,
        password: dbconn.pass,
        host: dbconn.host,
        port: dbconn.port,
        database: dbconn.database_name,
    }
);

const userTable = new UserTable();

const insertToUser = async (firstName, lastName) => {
    const query = `insert into ${userTable.tableName} (${userTable.firstName}, ${userTable.lastName}) values ($1, $2) returning *;`;
    const result = await localPool.query(query, [firstName, lastName]);
    return result.rows;
}

export { insertToUser };