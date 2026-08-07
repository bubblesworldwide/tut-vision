//microsoft identifiers for the TUT Vision Dev app registration
//these are PUBLIC identifiers — safe to commit. a client SECRET would not be (we don't have one; SPAs must not).
export const TENANT_ID = '7bfa4f77-c642-4cea-8736-955b6906bf7e'; //directory (tenant) id
export const CLIENT_ID = '141a9b6f-a59c-4d50-a4ee-8c3378c1cbff'; //application (client) id

//the scope that makes microsoft issue a token FOR OUR API rather than for graph
export const API_SCOPE = `api://${CLIENT_ID}/access_as_user`; //created under Expose an API

//where the express backend lives
export const API_BASE = 'http://localhost:3000'; //TODO move to environment files before deploying