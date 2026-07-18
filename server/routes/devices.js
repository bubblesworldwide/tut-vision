const express = require('express'); //load express for its router tool
const pool = require('../db'); //grab the shared db pool from server/db.js

const router = express.Router(); //mini-app holding device + notification routes

//REGISTER a device for a user (phone/browser that will receive push later)
router.post('/users/:id/devices', async (request, response) => { //POST = create something new
  const userId = request.params.id; //whose device, from the url
  const { platform, pushToken, geofenceEnabled } = request.body; //device details from the json body

  try { //try the insert; jump to catch on failure
    const result = await pool.query( //run the INSERT and wait for the new row
      `INSERT INTO device (user_id, platform, push_token, geofence_enabled)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      //platform must be 'ios', 'android' or 'web' — the table's CHECK enforces it,
      //anything else fails the insert and lands in catch
      [userId, platform, pushToken ?? null, geofenceEnabled ?? false] //?? = fallback if the caller left it out
    );
    response.status(201).json(result.rows[0]); //201 = created; send back the new device
  } catch (err) { //e.g. unknown platform or bad user id
    console.error(err); //log the real error for us
    response.status(400).json({ error: 'Could not register device' }); //400 = caller's fault
  }
});

//UPDATE a device's push token or geofence opt-in (partial updates allowed)
router.put('/devices/:id', async (request, response) => { //PUT = update something that exists
  const deviceId = request.params.id; //which device, from the url
  const { pushToken, geofenceEnabled } = request.body; //either may be missing

  try { //try the update; jump to catch on failure
    const result = await pool.query( //run the UPDATE and await the changed row
      `UPDATE device
          SET push_token       = COALESCE($1, push_token),
              geofence_enabled = COALESCE($2, geofence_enabled)
        WHERE id = $3
        RETURNING *`,
      //COALESCE keeps the old value for any field the caller didn't send — same trick as slots
      [pushToken ?? null, geofenceEnabled ?? null, deviceId] //?? null turns undefined into null so pg accepts it
    );
    if (result.rows.length === 0) { //nothing updated = no device with that id
      return response.status(404).json({ error: 'Device not found' }); //404 = not found
    }
    response.json(result.rows[0]); //send back the updated device
  } catch (err) { //if it failed...
    console.error(err); //log it
    response.status(400).json({ error: 'Could not update device' }); //400 = caller's fault
  }
});

//UPDATE a student's notification preferences for one staff member they follow
router.put('/follows/preferences', async (request, response) => { //prefs live ON the follow row itself
  const { studentId, staffId, notifyStateChanges, notifyMessages } = request.body; //ids + any prefs being changed

  try { //try the update; jump to catch on failure
    const result = await pool.query( //run the UPDATE and await the changed row
      `UPDATE follow
          SET notify_state_changes = COALESCE($1, notify_state_changes),
              notify_messages      = COALESCE($2, notify_messages)
        WHERE student_id = $3
          AND staff_id   = $4
        RETURNING *`,
      [notifyStateChanges ?? null, notifyMessages ?? null, studentId, staffId] //fills $1-$4 safely
    );
    if (result.rows.length === 0) { //nothing updated = that follow doesn't exist
      return response.status(404).json({ error: 'Follow not found' }); //can't set prefs on a follow that isn't there
    }
    response.json(result.rows[0]); //send back the follow with its new prefs
  } catch (err) { //if it failed...
    console.error(err); //log it
    response.status(500).json({ error: 'Could not update preferences' }); //reply with 500
  }
});

module.exports = router; //hand this router to index.js