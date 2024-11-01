CREATE DATABASE cs375_group_one;
\c cs375_group_one;

DROP TABLE IF EXISTS users;

CREATE TABLE users (
    pid SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);