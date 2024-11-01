// models/tables.js

const { localPool } = require('./dbConnection.js');

class UserTable {
    constructor() {
        this.tableName = 'users';
        this.fieldDBCode = 'pid';
        this.fieldUsername = 'username';
        this.fieldPassword = 'password';
    }

    // Insert a new user into the database
    insert = async (username, password) => {

        const query = `
            INSERT INTO ${this.tableName} 
            (${this.fieldUsername}, ${this.fieldPassword}) 
            VALUES ($1, $2) 
            RETURNING *;
        `;

        const result = await localPool.query(query, [username, password]);
        return result.rows[0]; // Return the inserted user
    };

    // Delete a user by pid
    delete = async (pid) => {
        const query = `
            DELETE FROM ${this.tableName} 
            WHERE ${this.fieldDBCode} = $1 
            RETURNING *;
        `;
        const result = await localPool.query(query, [pid]);
        return result.rows[0]; // Return the deleted user
    };

    // Find a user by username
    findByUsername = async (username) => {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE ${this.fieldUsername} = $1;
        `;
        const result = await localPool.query(query, [username]);
        return result.rows[0]; // Return the found user
    };
}

module.exports = { UserTable };
