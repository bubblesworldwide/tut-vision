const express = require('express'); //load express for its router tool
const pool = require('../db'); //grab the shared db pool from server/db.js
const requireAuth = require('../middleware/auth'); //verifies the microsoft token
const { loadUser, requireSelf } = require('../middleware/user'); //resolves the token to our db row, then checks ownership

const router = express.Router(); //mini-app holding the read-only routes

//POLICY: departments and staff profiles are visible to ANY signed-in user —
//that's the point of the app, students look staff up. following lists are NOT:
//who a student follows is personal, so that route adds requireSelf.

//list all departments with their faculty and campus names
router.get('/departments', requireAuth, loadUser, async (request, response) => { //GET = fetch data
  try { //try the db read; jump to catch on failure
    const result = await pool.query( //run the query and wait for the rows
      `SELECT department.id,
              department.name AS department,
              faculty.name AS faculty,
              campus.name AS campus
       FROM department
       JOIN faculty ON department.faculty_id = faculty.id
       JOIN campus ON faculty.campus_id = campus.id
       ORDER BY department.name`
    ); //no user input here, so no placeholders needed
    response.json(result.rows); //send the list back as JSON
  } catch (err) { //if the query failed...
    console.error(err); //log it for us
    response.status(500).json({ error: 'Could not load departments' }); //reply 500
  }
});

//one staff member's full profile: their status, active message, and schedule
router.get('/staff/:id', requireAuth, loadUser, async (request, response) => { //':id' = the staff member's id
  const staffId = request.params.id; //read the id from the url

  try { //try the db reads; jump to catch on failure
    const profile = await pool.query( //first query: the person + their status + active message
      `SELECT users.name,
              users.email,
              status_state.availability,
              status_state.presence,
              status_message.text AS message
       FROM users
       LEFT JOIN status_state ON status_state.user_id = users.id
       LEFT JOIN status_message ON status_message.user_id = users.id
                               AND status_message.active = true
       WHERE users.id = $1`,
      [staffId] //fills $1 safely
    );

    if (profile.rows.length === 0) { //no row = no user with that id
      return response.status(404).json({ error: 'Staff member not found' }); //404 = not found
    }

    const schedule = await pool.query( //second query: their weekly consultation slots
      `SELECT day_of_week, start_time, end_time
       FROM consultation_slot
       WHERE user_id = $1
       ORDER BY day_of_week, start_time`,
      [staffId] //fills $1 safely
    );

    const fullProfile = profile.rows[0]; //the single profile row
    fullProfile.schedule = schedule.rows; //attach the schedule rows onto it
    response.json(fullProfile); //send the combined object back as JSON
  } catch (err) { //if either query failed...
    console.error(err); //log it
    response.status(500).json({ error: 'Could not load staff profile' }); //reply 500
  }
});

//the staff a given student follows — PERSONAL, so only that student may read it
router.get('/students/:id/following', requireAuth, loadUser, requireSelf, async (request, response) => { //':id' = the student's id
  const studentId = request.params.id; //read the id from the url

  try { //try the db read; jump to catch on failure
    const result = await pool.query( //run the query and wait for the rows
      `SELECT users.id,
              users.name,
              status_state.availability,
              status_state.presence
       FROM follow
       JOIN users ON follow.staff_id = users.id
       LEFT JOIN status_state ON status_state.user_id = users.id
       WHERE follow.student_id = $1
       ORDER BY users.name`,
      [studentId] //fills $1 safely
    );
    response.json(result.rows); //send the followed-staff list back as JSON
  } catch (err) { //if the query failed...
    console.error(err); //log it
    response.status(500).json({ error: 'Could not load following list' }); //reply 500
  }
});

module.exports = router; //hand this router to index.js