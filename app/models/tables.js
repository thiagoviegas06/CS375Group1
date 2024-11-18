const { localPool } = require('./dbConnection.js');

class UserTable {
    constructor() {
        this.tableName = 'users';
        this.fieldDBCode = 'pid';
        this.fieldUsername = 'username';
        this.fieldPassword = 'password';
    }

    insert = async (username, password) => {

        const query = `
            INSERT INTO ${this.tableName} 
            (${this.fieldUsername}, ${this.fieldPassword}) 
            VALUES ($1, $2) 
            RETURNING *;
        `;

        const result = await localPool.query(query, [username, password]);
        return result.rows[0];
    };

    // Delete a user by pid
    delete = async (pid) => {
        const query = `
            DELETE FROM ${this.tableName} 
            WHERE ${this.fieldDBCode} = $1 
            RETURNING *;
        `;
        const result = await localPool.query(query, [pid]);
        return result.rows[0];
    };

    // Find a user by username
    findByUsername = async (username) => {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE ${this.fieldUsername} = $1;
        `;
        const result = await localPool.query(query, [username]);
        return result.rows[0];
    };
}

module.exports = { UserTable };


class RestuarantTable {
    constructor() {
        this.tableName = 'restuarants';
        this.fieldDBCode = 'pid';
        this.fieldRestuarant = 'restuarantname';
        this.fieldCity = 'city';
        this.fieldCuisine = 'cuisine';
        this.fieldPrice = 'price';
        this.fieldImage = 'image';
    }

    // Add a new restuarant
    insert = async (username, password) => {
        const query = `
            INSERT INTO ${this.tableName} 
            (name, city, cuisine, price, image) 
            VALUES (%s, %s, %s, %s, %s) 
            RETURNING *;
        `;
        const result = await localPool.query(query, [restuarantname, city, cuisine, price, image]);
        return result.rows[0];
    }

    //Find a restuarant by name
    findByName = async (restuarantname) => {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE ${this.fieldRestuarant} = $1;
        `;
        const result = await localPool.query(query, [restuarantname]);
        return result.rows[0];
    }

    //Find a restuarant by city
    findByCity = async (city) => {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE ${this.fieldCity} = $1;
        `;
        const result = await localPool.query(query, [city]);
        return result.rows[0];
    }

    //Find restuarants by all fields
    findByAll = async (city, cuisine, price) => {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE ${this.fieldCity} = $1 AND ${this.fieldCuisine} = $2 AND ${this.fieldPrice} = $3;
        `;
        const result = await localPool.query(query, [city, cuisine, price]);
        return result.rows[0];
    }


}

module.exports = { RestuarantTable };