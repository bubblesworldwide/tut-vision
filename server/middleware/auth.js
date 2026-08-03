const jwt = require('jsonwebtoken'); //verifies and decodes JWT tokens
const jwksClient = require('jwks-rsa'); //fetches Microsoft's public signing keys

//where Microsoft publishes the public keys for our tenant's tokens
const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.TENANT_ID}/discovery/v2.0/keys`, //tenant-specific key endpoint
  cache: true, //remember keys so we don't refetch on every request
  cacheMaxAge: 86400000, //keep them 24h (milliseconds) — microsoft rotates keys rarely
});

//given a token's key id (kid), look up the matching public key
function getKey(header, callback) { //jwt.verify calls this for us
  client.getSigningKey(header.kid, (err, key) => { //ask microsoft's key set for this kid
    if (err) return callback(err); //couldn't fetch the key
    callback(null, key.getPublicKey()); //hand the public key back to jwt.verify
  });
}

//=== SWAP-IN POINT — pending Kyle's answer (spec §11, open question 2) ===
//assumption from seed data: staff are @tut.ac.za, students are @tutmail.ac.za
//if Kyle says use directory groups or a role claim, replace THIS FUNCTION ONLY
function isStaffEmail(email) { //email comes from the verified token, never from the caller
  if (!email) return false; //no email claim = don't assume staff
  return email.toLowerCase().endsWith('@tut.ac.za'); //@tutmail.ac.za fails this, so students read as students
}

//the middleware itself: runs BEFORE a protected route's handler
function requireAuth(request, response, next) { //next = "carry on to the real route"
  const authHeader = request.headers.authorization; //tokens arrive as "Authorization: Bearer <token>"

  if (!authHeader || !authHeader.startsWith('Bearer ')) { //no token at all
    return response.status(401).json({ error: 'No token provided' }); //401 = who are you?
  }

  const token = authHeader.split(' ')[1]; //split on the space, keep the token half

  jwt.verify( //check the signature and the claims
    token, //the token string
    getKey, //function that supplies the right public key
    {
      audience: [process.env.CLIENT_ID, `api://${process.env.CLIENT_ID}`], //microsoft uses either form — accept both
      issuer: [ //microsoft issues v1 and v2 tokens with different issuer strings — accept both
        `https://login.microsoftonline.com/${process.env.TENANT_ID}/v2.0`, //v2 endpoint issuer
        `https://sts.windows.net/${process.env.TENANT_ID}/`, //v1 endpoint issuer (mind the trailing slash)
      ],
      algorithms: ['RS256'], //only accept microsoft's signing algorithm
    },
    (err, decoded) => { //runs once verification finishes
      if (err) { //bad signature, expired, wrong audience or issuer
        console.error(err); //log the real reason for us
        return response.status(401).json({ error: 'Invalid token' }); //generic message to the caller
      }

      request.user = { //attach the verified identity to the request
        oid: decoded.oid, //microsoft's permanent id — matches users.microsoft_oid
        name: decoded.name, //display name from the token
        email: decoded.preferred_username || decoded.upn || decoded.unique_name || decoded.email, //v2 uses preferred_username, v1 uses upn/unique_name
        isStaff: isStaffEmail(decoded.preferred_username), //see swap-in point above
      };

      next(); //identity confirmed — let the real route run
    }
  );
}

module.exports = requireAuth; //hand the bouncer to the routes that need it