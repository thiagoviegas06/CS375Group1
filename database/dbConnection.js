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

export { localPool };