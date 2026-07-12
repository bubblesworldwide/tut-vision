const express = require('express') //load express so we can build web server
const pool = require('./db')//grab shared database pool from db.js
const app = express(); //call express to create web server app and store it
app.use(express.json()); //read json bodies so write endpoints can use request.body

const userRoutes = require('./routes/users'); //status and message endpoints
const followRoutes = require('./routes/follows'); //follow and unfollow endpoints

//routing
app.get('/', (request,response) => //when a get request hits the '/' URL
{
    response.send('TUT Vision API is alive'); //send this text back to whoever who asks
});

// Dashboard route: for a department id, return its staff and their live status.
app.get('/api/departments/:id/dashboard', async (request, response) => { // ':id' = a changeable slot in the URL
  const departmentId = request.params.id;    // read the id out of the URL (e.g. '1')

  try {                                       // try the DB read; jump to catch on failure
    const result = await pool.query(          // run the SQL and wait for the rows
      `SELECT users.name,
              status_state.availability,
              status_state.presence,
              status_message.text AS message
       FROM users
       JOIN status_state ON status_state.user_id = users.id
       LEFT JOIN status_message ON status_message.user_id = users.id
                               AND status_message.active = true
       WHERE users.role = 'staff'
         AND users.department_id = $1`,
      [departmentId]                          // fills $1 safely — prevents SQL injection
    );
    response.json(result.rows);               // send the rows back as JSON
  } catch (err) {                             // if the query threw an error...
    console.error(err);                       // ...log it here for us
    response.status(500).json({ error: 'Something went wrong' }); // ...reply with 500
  }
});

//mount the route files so requests under /api reach them
app.use('/api', userRoutes); //e.g. /api/users/:id/status
app.use('/api', followRoutes); //e.g. /api/follows

//choose port since .env does not have one fall back to 3000
const PORT = process.env.PORT || 3000; // || means left or right values if left is empty

//start the server listening on port
app.listen(PORT, () => //start accepting requests on the port
{
    console.log(`Server running on http://localhost:${PORT}`); //print the address to confirm it started
});