//reach into the 'pg' library and pull out its pool tool (pg = PostgreSQL client for Node).
const {Pool} = require('pg')

//load the .env file so that the secrets inside it become available on the process.env below
require('dotenv').config();

//create one shared pool of reusable database connections for the whole app
const pool = new Pool({
    host: process.env.DB_HOST, //which machine the database is on which is this pc
    port: process.env.DB_PORT, //the port postgress listens on 5432 which is the default
    user: process.env.DB_USER, //the database login name('postgres')
    password: process.env.DB_PASSWORD, //the secret read from .env so its never written in this file
    database: process.env.DB_NAME,//which database to connect to which is ('tut_vision')
});

//make this pool available to any other file that requires ('./db')
module.exports = pool;