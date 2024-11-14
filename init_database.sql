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
    address VARCHAR(255) NOT NULL,
    phone_number VARCHAR(255) NOT NULL,
    rating DECIMAL(2,1) NOT NULL,
    price INT NOT NULL,
    cuisine VARCHAR(255) NOT NULL,
    website VARCHAR(255) NOT NULL,
    image VARCHAR(255) NOT NULL
);