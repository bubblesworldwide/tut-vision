const express = require('express'); // load Express (for its Router tool)
const pool = require('../db');      // grab the shared DB pool from server/db.js
const requireAuth = require('../middleware/auth');              // verifies the microsoft token
const { loadUser, requireBodySelf } = require('../middleware/user'); // resolves the token to our db row, then checks the body ids

const router = express.Router();    // mini-app holding the follow-related routes

// FOLLOW: a student follows a staff member.
router.post('/follows', requireAuth, loadUser, requireBodySelf('studentId'), async (request, response) => {   // POST = create a new follow link
  const { studentId, staffId } = request.body;   // both ids arrive in the JSON body (destructuring)

  try {                                           // try the insert; jump to catch on failure
    const result = await pool.query(              // run the INSERT and await the new row
      `INSERT INTO follow (student_id, staff_id)
       VALUES ($1, $2)
       RETURNING *`,
      [studentId, staffId]                        // values for $1, $2 — passed safely
    );
    response.status(201).json(result.rows[0]);    // 201 = created; send back the new follow
  } catch (err) {                                 // the UNIQUE(student_id, staff_id) rule blocks duplicates
    console.error(err);                           // log the real error for us
    response.status(400).json({ error: 'Could not follow (already following?)' }); // 400 = bad request
  }
});

// UNFOLLOW: remove the follow link between a student and a staff member.
router.delete('/follows', requireAuth, loadUser, requireBodySelf('studentId'), async (request, response) => {  // DELETE = remove the link
  const { studentId, staffId } = request.body;   // both ids from the JSON body

  try {                                           // try the delete; jump to catch on failure
    const result = await pool.query(              // run the DELETE and await the removed row
      `DELETE FROM follow
        WHERE student_id = $1
          AND staff_id = $2
        RETURNING *`,
      [studentId, staffId]                        // values for $1, $2
    );
    if (result.rows.length === 0) {               // nothing deleted = that follow didn't exist
      return response.status(404).json({ error: 'Follow not found' }); // 404 = not found
    }
    response.json({ unfollowed: true });          // confirm it worked
  } catch (err) {                                 // if it failed...
    console.error(err);                           // log it
    response.status(500).json({ error: 'Could not unfollow' }); // reply with 500
  }
});

module.exports = router;   // hand this router to index.js