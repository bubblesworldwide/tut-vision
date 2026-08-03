const pool = require('../db'); //shared postgres pool so we can look the user up

//turns the verified microsoft identity into an actual row from our users table
async function loadUser(request, response, next) { //runs AFTER requireAuth, so request.user already exists
  try { //the lookup can fail
    const result = await pool.query( //find the row whose microsoft_oid matches the token
      `SELECT id, name, email, role, department_id
         FROM users
        WHERE microsoft_oid = $1`, //$1 keeps it injection-safe
      [request.user.oid] //oid came from the VERIFIED token, never from the caller
    );

    if (result.rows.length === 0) { //real microsoft account, but not provisioned in our db
      return response.status(403).json({ error: 'Account not registered in TUT Vision' }); //403 = I know you, you're not allowed
    }

    request.dbUser = result.rows[0]; //attach OUR user row alongside the token identity
    next(); //carry on to the route
  } catch (err) { //db down, bad sql, etc
    console.error(err); //log the real reason for us
    response.status(500).json({ error: 'Could not load user' }); //generic message out
  }
}

//blocks a caller from acting on someone else's user id
function requireSelf(request, response, next) { //runs AFTER loadUser, so request.dbUser exists
  const urlId = String(request.params.id).toLowerCase(); //the id the caller put in the url
  const myId = String(request.dbUser.id).toLowerCase(); //the id we resolved from their token

  if (urlId !== myId) { //they're aiming at somebody else's record
    return response.status(403).json({ error: 'You can only modify your own record' }); //403 not 401 — identity is fine, permission isn't
  }

  next(); //ids match — let the route run
}

module.exports = { loadUser, requireSelf }; //two named exports, so import with { } braces