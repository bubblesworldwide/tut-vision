const express = require('express'); // load Express (for its Router tool)
const pool = require('../db');      // grab the shared DB pool from server/db.js

const router = express.Router();    // mini-app holding the user-related routes

// UPDATE a user's availability + presence.
router.put('/users/:id/status', async (request, response) => {  // PUT = "update something that already exists"
  const userId = request.params.id;                  // whose status, taken from the URL
  const { availability, presence } = request.body;   // unpack the two new values from the JSON body (destructuring)

  try {                                               // try the DB write; jump to catch on failure
    const result = await pool.query(                  // run the UPDATE and await the result
      `UPDATE status_state
          SET availability = $1,
              presence = $2,
              updated_at = now()
        WHERE user_id = $3
        RETURNING *`,
      [availability, presence, userId]                // values for $1, $2, $3 — passed safely
    );
    if (result.rows.length === 0) {                   // nothing changed = no status row for that user
      return response.status(404).json({ error: 'User status not found' }); // 404 = not found
    }
    response.json(result.rows[0]);                    // success: send back the updated row
  } catch (err) {                                     // e.g. an invalid availability the DB's CHECK rejects
    console.error(err);                               // log the real error for us
    response.status(400).json({ error: 'Invalid status update' }); // 400 = bad request (caller's fault)
  }
});

// POST a new status message for a user (e.g. "Off sick today").
router.post('/users/:id/messages', async (request, response) => { // POST = "create something new"
  const userId = request.params.id;   // whose message, from the URL
  const { text } = request.body;      // the message text from the JSON body

  try {                                               // try the insert; jump to catch on failure
    const result = await pool.query(                  // run the INSERT and await the new row
      `INSERT INTO status_message (user_id, text)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, text]                                  // values for $1, $2
    );
    response.status(201).json(result.rows[0]);        // 201 = created; send back the new message
  } catch (err) {                                     // if the insert failed...
    console.error(err);                               // log it for us
    response.status(400).json({ error: 'Could not post message' }); // tell the caller it was a bad request
  }
});

// CLEAR (deactivate) a user's active status messages — a soft clear, keeping the history.
router.delete('/users/:id/messages', async (request, response) => { // DELETE = "remove / clear"
  const userId = request.params.id;   // whose messages, from the URL

  try {                                               // try the update; jump to catch on failure
    await pool.query(                                 // flip active to false instead of hard-deleting
      `UPDATE status_message
          SET active = false
        WHERE user_id = $1
          AND active = true`,
      [userId]                                        // value for $1
    );
    response.json({ cleared: true });                 // confirm it worked
  } catch (err) {                                     // if it failed...
    console.error(err);                               // log it
    response.status(500).json({ error: 'Could not clear messages' }); // reply with 500
  }
});

module.exports = router;   // hand this router to index.js