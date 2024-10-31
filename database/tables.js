import { localPool } from "./dbConnection.js";
class UserTable{
    constructor(){
        this.tableName = "users";
        this.fieldDBCode = "pid";
        this.fieldFirstName = "first_name";
        this.fieldLastName = "last_name";
    }

    insert = async (firstName, lastName) => {
        const query = `insert into ${this.tableName} (${this.fieldFirstName}, ${this.fieldLastName}) values ($1, $2) returning *;`;
        console.log(query);
        const result = await localPool.query(query, [firstName, lastName]);
        return result.rows;
    }
}

export {UserTable};