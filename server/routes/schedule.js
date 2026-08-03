const express = require('express'); //load express for its router tool
const pool = require('../db'); //grab the shared db pool from server/db.js
const requireAuth = require('../middleware/auth'); //verifies the microsoft token
const { loadUser, requireSelf, requireOwner } = require('../middleware/user'); //resolves the token to our db row, then checks ownership

const router = express.Router(); //mini-app holding the schedule routes

//CREATE a consultation slot for a staff member
router.post('/users/:id/slots', requireAuth, loadUser, requireSelf, async (request, response) => { //POST = make something new
  const userId = request.params.id; //whose slot, from the url
  const { dayOfWeek, startTime, endTime } = request.body; //the slot details from the json body

  try { //try the insert; jump to catch on failure
    const result = await pool.query( //run the INSERT and wait for the new row
      `INSERT INTO consultation_slot (user_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, dayOfWeek, startTime, endTime] //fills $1-$4 safely
    );
    response.status(201).json(result.rows[0]); //201 = created; send back the new slot
  } catch (err) { //e.g. bad time format or missing user
    console.error(err); //log the real error for us
    response.status(400).json({ error: 'Could not create slot' }); //400 = caller's fault
  }
});

//UPDATE one consultation slot by its id (partial updates allowed)
router.put('/slots/:id', requireAuth, loadUser, requireOwner('consultation_slot'), async (request, response) => { //PUT = update something that exists
  const slotId = request.params.id; //which slot, from the url
  const { dayOfWeek, startTime, endTime } = request.body; //any of these may be missing

  try { //try the update; jump to catch on failure
    const result = await pool.query( //run the UPDATE and await the changed row
      `UPDATE consultation_slot
          SET day_of_week = COALESCE($1, day_of_week),
              start_time  = COALESCE($2, start_time),
              end_time    = COALESCE($3, end_time)
        WHERE id = $4
        RETURNING *`,
      //COALESCE = "use the first value that isn't null" — so if the caller
      //didn't send a field, $n arrives as null and the column keeps its old value.
      //this is how one route handles both full and partial edits.
      [dayOfWeek ?? null, startTime ?? null, endTime ?? null, slotId] //?? null turns undefined into null so pg accepts it
    );
    if (result.rows.length === 0) { //nothing updated = no slot with that id
      return response.status(404).json({ error: 'Slot not found' }); //404 = not found
    }
    response.json(result.rows[0]); //send back the updated slot
  } catch (err) { //e.g. an invalid time value
    console.error(err); //log it
    response.status(400).json({ error: 'Could not update slot' }); //400 = caller's fault
  }
});

//DELETE one consultation slot by its id
router.delete('/slots/:id', requireAuth, loadUser, requireOwner('consultation_slot'), async (request, response) => { //DELETE = remove something
  const slotId = request.params.id; //the slot's id, from the URL

  try { //try the delete; jump to catch on failure
    const result = await pool.query( //run the DELETE and await the removed row
      `DELETE FROM consultation_slot
        WHERE id = $1
        RETURNING *`,
      [slotId] //value for $1
    );
    if (result.rows.length === 0) { //nothing deleted = no slot with that id
      return response.status(404).json({ error: 'Slot not found' }); //404 = not found
    }
    response.json({ deleted: true }); //confirm it worked
  } catch (err) { //if it failed...
    console.error(err); //log it
    response.status(500).json({ error: 'Could not delete slot' }); //reply with 500
  }
});

module.exports = router; //hand this router to index.js