CREATE DATABASE cs375_group_one;
\c cs375_group_one;

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS restuarants;

CREATE TABLE users (
    pid SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE restuarants (
    pid SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    cuisine VARCHAR(255) NOT NULL,
    image BLOB NOT NULL
);