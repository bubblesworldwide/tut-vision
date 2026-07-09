const express = require('express') //load express so we can build web server
const pool = require('./db')//grab shared database pool from db.js
const app = express(); //call express to create web server app and store it

//routing
app.get('/', (request,response) => //when a get request hits the '/' URL
{
    response.send('TUT Vision API is alive'); //send this text back to whoever who asks
});

//choose port since .env does not have one fall back to 3000
const PORT = process.env.PORT || 3000; // || means left or right values if left is empty

//start the server listening on port
app.listen(PORT, () => //start accepting requests on the port
{
    console.log(`Server running on http://localhost:${PORT}`); //print the address to confirm it started
});

