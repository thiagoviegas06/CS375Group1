--create database cs375_group_one;
drop table users;

create table users(
    pid         serial  primary key,
    first_name  text,
    last_name   text    not null
);