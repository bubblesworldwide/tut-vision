const pool = require('../db'); //shared postgres pool so we can look the user up

//tables whose rows have a user_id owner column — an allowlist, see requireOwner
const OWNED_TABLES = ['consultation_slot', 'device']; //ONLY these names may reach the sql below

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

//BUILDS a middleware that checks the caller owns the row named by :id in the given table
function requireOwner(table) { //takes a table name and RETURNS a middleware function
  if (!OWNED_TABLES.includes(table)) { //guard: only allowlisted names are ever used
    throw new Error(`requireOwner: ${table} is not an owned table`); //fails loudly at startup, not at request time
  }

  return async function (request, response, next) { //THIS inner function is what express runs per request
    try { //the lookup can fail
      const result = await pool.query( //fetch just the owner column for that row
        `SELECT user_id FROM ${table} WHERE id = $1`, //table name is from our allowlist; the id is parameterised
        [request.params.id] //the row id from the url
      );

      if (result.rows.length === 0) { //no row with that id
        return response.status(404).json({ error: 'Not found' }); //404 before we discuss ownership
      }

      const ownerId = String(result.rows[0].user_id).toLowerCase(); //who the row belongs to
      const myId = String(request.dbUser.id).toLowerCase(); //who is asking

      if (ownerId !== myId) { //the row belongs to someone else
        return response.status(403).json({ error: 'You can only modify your own records' }); //403 = permission, not identity
      }

      next(); //it's theirs — let the route run
    } catch (err) { //db error, etc
      console.error(err); //log the real reason for us
      response.status(500).json({ error: 'Could not verify ownership' }); //generic message out
    }
  };
}

//BUILDS a middleware that checks a named body field holds the caller's own id
function requireBodySelf(field) { //takes the body field name and RETURNS a middleware
  return function (request, response, next) { //what express runs per request
    const claimed = String(request.body?.[field] ?? '').toLowerCase(); //the id the caller put in the json body
    const myId = String(request.dbUser.id).toLowerCase(); //the id we resolved from their token

    if (claimed !== myId) { //they're trying to act on someone else's behalf
      return response.status(403).json({ error: `${field} must be your own id` }); //403 = permission
    }

    next(); //matches — let the route run
  };
}

module.exports = { loadUser, requireSelf, requireOwner, requireBodySelf }; //four named exports