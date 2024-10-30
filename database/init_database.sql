--create database cs375_group_one;

create table users(
    pid         serial  primary key,
    first_name  text,
    last_name   text    not null
);