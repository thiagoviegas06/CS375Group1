import { localPool } from "./dbConnection.js";
class UserTable{
    constructor(){
        this.tableName = "users";
        this.fieldDBCode = "pid";
        this.fieldFirstName = "first_name";
        this.fieldLastName = "last_name";
    };

    insert = async (firstName, lastName) => {
        const query = `insert into ${this.tableName} (${this.fieldFirstName}, ${this.fieldLastName}) values ($1, $2) returning *;`;
        const result = await localPool.query(query, [firstName, lastName]);
        return result.rows;
    };

    delete = async (pid) => {
        const query = `delete from ${this.tableName} where ${this.fieldDBCode} = $1 returning *;`;
        const result = await localPool.query(query, [pid]);
        return result.rows;
    };
}

export {UserTable};